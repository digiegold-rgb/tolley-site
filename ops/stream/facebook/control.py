#!/usr/bin/env python3
"""stream facebook status|prepare [title]|select ID|key …|send ID|golive [title] --confirm-public|end|stop.

key SERVER-URL STREAM-KEY [BACKUP-KEY]  bind a stream key copied from Facebook Live Producer
key --stdin                             same, reading server, key and optional backup as lines (keeps keys out of argv)
key clear                               forget the pasted key and return to Spark-made previews
golive --confirm-public                 one click: Spark preview + send + publish once Meta receives video (Jared's readiness required)
end                                     end the Facebook show on the platform, then stop the sender
Public feed recovery requires `resume ID --confirm-public`.
"""
import argparse
import json
import sys
from pathlib import Path

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=["status", "prepare", "select", "key", "send", "golive", "end", "stop", "resume"], nargs="?", default="status")
    parser.add_argument("value", nargs="*")
    parser.add_argument("--confirm-public", action="store_true")
    parser.add_argument("--stdin", action="store_true", help="key: read server URL, stream key and optional backup key from stdin, one per line")
    args = parser.parse_args()
    env = dict(line.split("=", 1) for line in (Path.home()/".config/tolley-stream/agent.env").read_text().splitlines() if "=" in line and not line.startswith("#"))
    value = " ".join(args.value)
    if args.action in ("select", "send", "resume") and not value.isdigit():
        parser.error("A Facebook live-video ID is required")
    if args.action in ("resume", "golive") and not args.confirm_public:
        parser.error("Going live / resuming a public feed requires Jared's readiness and --confirm-public")
    path, body = "status", None
    if args.action == "prepare": path, body = "facebook/prepare", {"title": value or "Treasure Hauls live show"}
    elif args.action == "key":
        if args.stdin:
            lines = [line.strip() for line in sys.stdin.read().splitlines() if line.strip()]
            if lines and lines[0].startswith("FB-"):
                lines.insert(0, "")  # key pasted first: use Facebook's default server
            lines += [""] * (3 - len(lines))
            server, key, backup = lines[:3]
        elif args.value == ["clear"]:
            server = key = backup = ""
        elif len(args.value) in (2, 3):
            server, key, backup = (args.value + [""])[:3]
        else:
            parser.error("Usage: key <server-url> <stream-key> [backup-key] | key --stdin | key clear")
        path, body = "facebook/key", {"server": server, "key": key, "backup": backup}
    elif args.action in ("select", "send", "resume"):
        path, body = "facebook/" + ("send" if args.action == "resume" else args.action), {"videoId": value}
        if args.action == "resume": body["confirmLive"] = value
    elif args.action == "golive": path, body = "facebook/golive", {"title": value or "Treasure Hauls live show", "confirm": True}
    elif args.action == "end": path, body = "facebook/end", {}
    elif args.action == "stop": path, body = "destinations", {"facebook": False}
    try:
        r = httpx.request("GET" if body is None else "POST", env["STREAM_URL"].rstrip("/") + "/" + path,
                          json=body, headers={"x-api-key": env["STREAM_KEY"]}, timeout=60)
        result = r.json()
        if r.status_code >= 400:
            print(json.dumps({"error": result.get("detail") or result.get("error") or "Facebook command failed"}))
            return 1
        print(json.dumps({"facebook": result.get("facebook", result), "sender": result.get("destinations", {}).get("facebook")}, indent=2))
        return 0
    except Exception:
        print("Facebook command was not confirmed. Check status before retrying.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
