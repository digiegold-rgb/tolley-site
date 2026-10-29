#!/usr/bin/env python3
"""Adapt tusd v2's completion hook to the existing authenticated intake."""
import json
import os
from pathlib import Path
import sys
import time
import urllib.request

event = json.load(sys.stdin)
upload = (event.get("Event") or event).get("Upload") or {}
root = Path(os.environ.get("TUS_STORAGE", "/home/jelly/video-incoming")).resolve()
source = Path(upload.get("Storage", {}).get("Path", "")).resolve()
if source.parent != root or not source.is_file():
    raise SystemExit("Invalid upload storage path")
upload["Storage"]["Path"] = "/srv/tusd-data/data/" + source.name
token = os.environ.get("CONTENT_API_KEY", "")
if not token:
    raise SystemExit("Missing upload hook credentials")
request = urllib.request.Request(os.environ.get("CONTENT_INTAKE_URL", "http://127.0.0.1:8096/api/internal/tus-finished"),
    data=json.dumps({"Upload": upload}).encode(),
    headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
for attempt in range(3):
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError("Intake rejected the upload")
        break
    except Exception:
        if attempt == 2:
            # The completed file stays in video-incoming for recovery.
            raise SystemExit("Upload saved; intake unavailable after three attempts")
        time.sleep(2)
