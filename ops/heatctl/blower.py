"""Furnace blower status from Honeywell telemetry; no Shelly power inference.

192.168.2.151 is the independent Fireplace Blower, not a furnace power meter.
Preserve the thermostat observation timestamp instead of refreshing stale data.
"""
import time
from pathlib import Path
from common import fresh, load, stamp

DEVICE_ID = "honeywell"
SOURCE = "honeywell_fan_status"
POLL_S, MAX_AGE_S = 10, 90


def from_thermostat(up, now):
    valid = (up.get("fresh") is True and type(up.get("fan_running")) is bool
             and fresh(up.get("observed_at"), now, MAX_AGE_S))
    return {"device_id": DEVICE_ID, "source": SOURCE, "read_only": True,
            "watts": None, "running": valid and up["fan_running"], "valid": valid,
            "observed_at": up.get("observed_at"), "ts": stamp(now),
            "error": None if valid else "Honeywell blower status missing or stale"}


def get_reading():
    state = load(Path.home()/"humid/state.json", {}) or {}
    up = (state.get("thermostats") or {}).get("honeywell") or {}
    return {"fresh": state.get("honeywell_ok") is True,
            "fan_running": up.get("fan_running"), "observed_at": up.get("t")}


class BlowerSensor:
    def __init__(self, read=get_reading, clock=time.time):
        self.read, self.clock = read, clock

    def sample(self):
        try:
            return from_thermostat(self.read(), self.clock())
        except Exception:
            return from_thermostat({}, self.clock())


def airflow(row, now):
    return bool(row.get("device_id") == DEVICE_ID and row.get("source") == SOURCE
                and row.get("valid") is True and row.get("running") is True
                and fresh(row.get("observed_at"), now, MAX_AGE_S))
