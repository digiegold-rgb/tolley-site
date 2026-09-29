#!/usr/bin/env python3
"""stream facebook status|prepare [title]|select ID|send ID|stop.

Public feed recovery requires `resume ID --confirm-public`; no publish command.
"""
import argparse
import json
from pathlib import Path

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["status", "prepare", "select", "send", "stop", "resume"], nargs="?", default="status")
    parser.add_argument("value", nargs="*")
    parser.add_argument("--confirm-public", action="store_true")
    args = parser.parse_args()
    env = dict(line.split("=", 1) for line in (Path.home()/".config/tolley-stream/agent.env").read_text().splitlines() if "=" in line and not line.startswith("#"))
    value = " ".join(args.value)
    if args.action in ("select", "send", "resume") and not value.isdigit():
        parser.error("A Facebook live-video ID is required")
    if args.action == "resume" and not args.confirm_public:
        parser.error("Resuming a public feed requires Jared's readiness and --confirm-public")
    path, body = "status", None
    if args.action == "prepare": path, body = "facebook/prepare", {"title": value or "Treasure Hauls live show"}
    elif args.action in ("select", "send", "resume"):
        path, body = "facebook/" + ("send" if args.action == "resume" else args.action), {"videoId": value}
        if args.action == "resume": body["confirmLive"] = value
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
