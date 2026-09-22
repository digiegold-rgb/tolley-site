"use client";

import { useEffect, useMemo, useState } from "react";

import { formatPhoneDisplay } from "@/lib/phone";
import { WD_VOICE_DISPLAY, parseDialTarget, type DialContact } from "@/lib/wd/call-numbers";

const RECENT_KEY = "wd-call-recent";

type Recent = { name: string; phone: string };

export function WdDialer({
  contacts,
  focus,
}: {
  contacts: DialContact[];
  focus: { phone: string; name: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState(focus?.phone ?? "");
  const [pasteName, setPasteName] = useState(focus?.name ?? "");
  const [busyPhone, setBusyPhone] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Recent[];
      if (Array.isArray(parsed)) setRecent(parsed.filter((r) => r && typeof r.phone === "string").slice(0, 8));
    } catch {
      /* private mode */
    }
  }, []);

  const quick = contacts.filter((c) => c.quick);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return contacts.filter((c) => {
      if (c.quick) return false;
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if (digits && c.phone.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });
  }, [contacts, query]);

  async function place(phone: string, name: string) {
    if (busyPhone) return;
    setBusyPhone(phone);
    setError("");
    setStatus("Ringing your cell…");
    try {
      const res = await fetch("/api/wd/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; loginUrl?: string };
      if (res.status === 401 && data.loginUrl) {
        window.location.assign(data.loginUrl);
        return;
      }
      if (!res.ok) {
        setStatus("");
        setError(data.error || "Could not start the call.");
        return;
      }
      setStatus(data.message || `Answer the call from ${WD_VOICE_DISPLAY}.`);
      remember(name, phone);
    } catch {
      setStatus("");
      setError("Could not reach the server. Try again.");
    } finally {
      setBusyPhone(null);
    }
  }

  function remember(name: string, phone: string) {
    const parsed = parseDialTarget(phone);
    const stored = parsed.ok ? parsed.phone : phone;
    if (contacts.some((c) => c.phone === stored)) return;
    const label = name || (parsed.ok ? formatPhoneDisplay(parsed.phone) : phone);
    const next = [{ name: label, phone: stored }, ...recent.filter((r) => r.phone !== stored)].slice(0, 8);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const focused = focus
    ? contacts.find((c) => c.phone === focus.phone) ?? {
        id: "focus",
        name: focus.name || formatPhoneDisplay(focus.phone),
        phone: focus.phone,
        detail: "From the link",
        quick: false,
      }
    : null;

  return (
    <>
      <h1>Wash &amp; Dry</h1>
      <p className="lede">
        Tap a tenant. Your cell rings first from {WD_VOICE_DISPLAY}. When you answer, we call them and they see that same number.
      </p>

      {focused && (
        <div className="card">
          <label>Ready</label>
          <button className="person" type="button" disabled={!!busyPhone} onClick={() => void place(focused.phone, focused.name)}>
            <span>
              <strong>{focused.name}</strong>
              <em>{formatPhoneDisplay(focused.phone)}</em>
            </span>
            <span className="go">{busyPhone === focused.phone ? "…" : "Call"}</span>
          </button>
        </div>
      )}

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void place(paste, pasteName);
        }}
      >
        <label htmlFor="wd-paste">Any number</label>
        <div className="row">
          <input
            id="wd-paste"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(816) 555-0142"
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              if (pasteName && e.target.value.replace(/\D/g, "") !== focus?.phone.replace(/\D/g, "")) setPasteName("");
            }}
          />
          <button className="call-btn" type="submit" disabled={!!busyPhone || paste.trim().length < 7}>
            {busyPhone && busyPhone === paste ? "…" : "Call"}
          </button>
        </div>
      </form>

      {(status || error) && (
        <div className={error ? "status err" : "status"} role="status">
          {error || status}
        </div>
      )}

      {quick.length > 0 && (
        <div className="chips">
          {quick.map((c) => (
            <button key={c.id} className="chip" type="button" disabled={!!busyPhone} onClick={() => void place(c.phone, c.name)}>
              <strong>{c.name}</strong>
              <span>{formatPhoneDisplay(c.phone)}</span>
            </button>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="card list">
          <label>Recent on this phone</label>
          {recent.map((c) => (
            <button key={c.phone} className="person" type="button" disabled={!!busyPhone} onClick={() => void place(c.phone, c.name)}>
              <span>
                <strong>{c.name}</strong>
                <em>{formatPhoneDisplay(c.phone)}</em>
              </span>
              <span className="go">Call</span>
            </button>
          ))}
        </div>
      )}

      <div className="card list">
        <label htmlFor="wd-find">Tenants</label>
        <input
          id="wd-find"
          type="search"
          placeholder="Search name or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length === 0 && <p className="empty">No matching tenants. Paste a number above.</p>}
        {filtered.map((c) => (
          <button key={c.id} className="person" type="button" disabled={!!busyPhone} onClick={() => void place(c.phone, c.name)}>
            <span>
              <strong>{c.name}</strong>
              <em>
                {formatPhoneDisplay(c.phone)}
                {c.detail ? ` · ${c.detail}` : ""}
              </em>
            </span>
            <span className="go">{busyPhone === c.phone ? "…" : "Call"}</span>
          </button>
        ))}
      </div>

      <p className="hint">
        On iPhone, open this page in Safari, tap Share, then Add to Home Screen. Bookmark{" "}
        <a href="/wd/call">tolley.io/wd/call</a>. You stay signed in with the same owner login as HQ.
      </p>
    </>
  );
}
