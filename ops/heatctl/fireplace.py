"""Identity-pinned fireplace OFF at the nightly cutoff, independent of HVAC."""
import fcntl
import json
import time
import urllib.request
from common import ROOT, atomic, load, stamp
import fire_policy

URL = "http://192.168.2.151"
DEVICE_ID = "shellyplugusg4-98c37700c550"


def rpc(method, params=None):
    if (method, params) not in (("Shelly.GetDeviceInfo", None),
                                ("Switch.GetStatus", {"id": 0}),
                                ("Switch.Set", {"id": 0, "on": False})):
        raise ValueError("Fireplace adapter permits only identity, status and OFF")
    data = None if params is None else json.dumps(params).encode()
    request = urllib.request.Request(URL+"/rpc/"+method, data=data,
                                    headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=3) as response:
        return json.load(response)


def finish(cfg, now=None):
    now = time.time() if now is None else now
    cutoff = fire_policy.due(now)
    first = fire_policy.policy().get("first_fireplace_cutoff", float("inf"))
    if cfg["mode"] != "live" or cutoff is None or cutoff < first:
        return None
    with (ROOT/"fireplace-cutoff.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = ROOT/"fireplace-cutoff-status.json"
        previous = load(path, {}) or {}
        if previous.get("cutoff_at") == cutoff:
            if previous.get("verified") or now-previous.get("attempt_at", 0) < 60:
                return previous
        row = {"cutoff_at": cutoff, "attempt_at": now, "ts": stamp(now),
               "device_id": DEVICE_ID, "url": URL, "on": False, "verified": False}
        try:
            if rpc("Shelly.GetDeviceInfo").get("id") != DEVICE_ID:
                raise ValueError("Fireplace Blower identity mismatch")
            rpc("Switch.Set", {"id": 0, "on": False})
            status = rpc("Switch.GetStatus", {"id": 0})
            if status.get("output") is not False:
                raise RuntimeError("Fireplace OFF readback failed")
            row.update(verified=True, verified_at=stamp(time.time()))
        except Exception as exc:
            row["error"] = str(exc)
        atomic(path, row)
        return row
