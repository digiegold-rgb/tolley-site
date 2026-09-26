#!/usr/bin/env python3
"""Read only supplier alerts / explicitly forwarded stock mail. Never mark mail read."""
import datetime
import email
import email.policy
import email.utils
import hashlib
import html
import imaplib
import json
import os
import re
import time
from pathlib import Path
import urllib.request
import urllib.parse
import urllib.error

SUPPLIERS = ("bstock.com", "equip-bid.com", "cargolargo.com", "directliquidation.com")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def expand_bstock_links(text, deadline):
    """Resolve only B-Stock's own email redirects, bounded and paced; never arbitrary URLs."""
    opener = urllib.request.build_opener(NoRedirect())
    appended = []
    links = list(dict.fromkeys(re.findall(r'https://(?:clicks|email)\.bstock\.com/[^\s<>"\']+', text)))[:12]
    for original in links:
        if time.monotonic() > deadline:
            break
        url = html.unescape(original)
        for _ in range(5):
            if time.monotonic() > deadline:
                break
            parsed = urllib.parse.urlparse(url)
            if parsed.hostname in ("bstock.com", "www.bstock.com"):
                if "/buy/listings/details/" in parsed.path:
                    appended.append(url)
                break
            if parsed.scheme != "https" or parsed.hostname not in ("clicks.bstock.com", "email.bstock.com") or parsed.username:
                break
            try:
                time.sleep(3.1)
                with opener.open(urllib.request.Request(url, method="HEAD"), timeout=12):
                    break
            except urllib.error.HTTPError as error:
                if error.code in (301, 302, 303, 307, 308):
                    url = urllib.parse.urljoin(url, error.headers.get("Location", ""))
                else:
                    break
            except (OSError, ValueError):
                break
    return text + "\n" + "\n".join(appended)


def api(path, body):
    request = urllib.request.Request(os.environ["STOCK_BASE_URL"].rstrip("/") + "/api/stock/worker/" + path,
        data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + os.environ["STOCK_WORKER_TOKEN"], "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def message_payload(raw):
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    subject = str(msg.get("Subject", "Supplier alert"))[:500]
    if any(word in subject.lower() for word in ("verification", "one-time", "password", "security code", "sign-in", "sign in")):
        return None
    parts = []
    for part in msg.walk():
        if part.get_content_type() in ("text/plain", "text/html") and part.get_content_disposition() != "attachment":
            content = part.get_content()
            parts.append(content if isinstance(content, str) else content.decode("utf-8", errors="replace"))
    try:
        observed = email.utils.parsedate_to_datetime(msg.get("Date", ""))
        if observed.tzinfo is None:
            observed = observed.replace(tzinfo=datetime.timezone.utc)
        observed = observed.astimezone(datetime.timezone.utc)
    except (ValueError, TypeError):
        observed = datetime.datetime.now(datetime.timezone.utc)
    return {"key": "mail:" + hashlib.sha256(str(msg.get("Message-ID", "")).encode() or raw).hexdigest(),
            "subject": subject, "text": "\n".join(parts)[:1500000], "observedAt": observed.isoformat().replace("+00:00", "Z")}


def main():
    started = time.monotonic()
    root = Path(os.environ.get("STOCK_STATE_DIR", str(Path.home() / ".local/state/tolley-stock")))
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    statefile = root / "mail-seen.json"
    seen = set(json.loads(statefile.read_text())) if statefile.exists() else set()
    client = imaplib.IMAP4_SSL("imap.gmail.com", timeout=25)
    client.login(os.environ["STOCK_MAIL_USER"], os.environ["STOCK_MAIL_PASSWORD"])
    client.select("INBOX", readonly=True)
    intake = os.environ.get("STOCK_INTAKE_ADDRESS", "")
    terms = ["from:" + supplier for supplier in SUPPLIERS]
    if intake:
        terms.append("to:" + intake)
    query = "newer_than:60d {" + " ".join(terms) + "}"
    status, results = client.uid("search", None, "X-GM-RAW", '"' + query + '"')
    if status != "OK":
        raise RuntimeError("Supplier mail search failed")
    validity = str(client.response("UIDVALIDITY")[1])
    queued = 0
    for uid in results[0].split()[-200:]:
        marker = validity + ":" + uid.decode()
        if marker in seen:
            continue
        status, parts = client.uid("fetch", uid, "(RFC822.SIZE)")
        size_text = str(parts)
        size = re.search(r"RFC822.SIZE (\d+)", size_text)
        if size and int(size.group(1)) > 2_000_000:
            api("status", {"id": "mail", "status": "error", "message": "A supplier email exceeds 2 MB; import its manifest manually."})
            raise RuntimeError("Oversized supplier email")
        status, parts = client.uid("fetch", uid, "(BODY.PEEK[])")
        if status != "OK":
            raise RuntimeError("Supplier mail fetch failed")
        raw = next(p[1] for p in parts if isinstance(p, tuple))
        payload = message_payload(raw)
        if payload:
            if "/buy/listings/details/" not in payload["text"] and not any(word in payload["subject"].lower() for word in ("welcome", "thoughts", "survey", "account setup")):
                payload["text"] = expand_bstock_links(payload["text"], min(started + 150, time.monotonic() + 30))
            api("email", payload)
            queued += 1
        seen.add(marker)
        tmp = root / "mail-seen.tmp"
        tmp.write_text(json.dumps(sorted(seen)))
        tmp.chmod(0o600)
        tmp.replace(statefile)
        if queued >= 50 or time.monotonic() - started > 150:
            break
    client.logout()
    api("process", {})
    api("status", {"id": "mail", "status": "ok", "message": f"Supplier inbox checked; {queued} new emails queued. Read status unchanged."})
    print(f"Stock mail: {queued} supplier emails queued")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        try:
            api("status", {"id": "mail", "status": "error", "message": "Email collection failed. Check mailbox credentials and worker connectivity."})
        except Exception:
            pass
        print("Stock email collection failed:", type(error).__name__)
        raise SystemExit(1)
