"""stream effects status|on|off|test. Test cannot run during a show."""
import json
from pathlib import Path
import sys
import time
import uuid

import httpx

config = dict(line.strip().split("=", 1) for line in
              (Path.home() / ".config/tolley-stream/agent.env").read_text().splitlines()
              if "=" in line and not line.lstrip().startswith("#"))
action = sys.argv[1] if len(sys.argv) > 1 else "status"
if action not in ("status", "on", "off", "test"):
    raise SystemExit("usage: stream effects status|on|off|test")
path = "settings" if action in ("on", "off") else action
body = {"enabled": action == "on"} if path == "settings" else {"id": str(uuid.uuid4()), "at": time.time()}
r = httpx.request("GET" if action == "status" else "POST", config["STREAM_URL"].rstrip("/") + "/effects/" + path,
                  headers={"x-api-key": config["STREAM_KEY"]}, json=body if action != "status" else None,
                  timeout=8, trust_env=False)
print(json.dumps(r.json(), indent=2))
if not r.is_success:
    raise SystemExit(1)
