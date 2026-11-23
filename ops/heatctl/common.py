"""Shared persistence and strictly bounded configuration. No device credentials."""
import json
import math
import os
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(os.environ.get("HEATCTL_HOME", str(Path.home() / "heatctl")))
TZ = ZoneInfo("America/Chicago")
DEFAULTS = {
    "mode": "shadow", "hvac_season": "heat", "wake": "07:00", "weekend_wake": "07:00",
    "day_target": 69.0, "raw_target": 70.0, "wake_target": 69.0, "cold_wake_target": 70.0,
    "night": "22:00", "earliest_warmup": "03:00", "warmup_buffer_min": 15,
    "sun_off": "16:00", "evening_bump": 1.0, "solar_credit": 0.5,
    "honeywell_min": 50.0, "honeywell_max": 73.0, "upstairs_floor": 66.0,
    "nest_min": 50.0, "nest_max": 80.0, "supp_high": 78.0, "supp_idle": 70.0,
    "sensor_max_age_s": 900, "thermostat_max_age_s": 300,
    "loft_quiet_hours": False, "stale_rh_max_on_s": 600, "forced_humid_max_h": 2,
    "rh_hysteresis": 3.0, "interlock_verified": False,
    "water_usd_per_gal": None, "gas_usd_per_ccf": 1.23, "electric_usd_per_kwh": 0.12495,
    "latitude": 39.0518, "longitude": -94.4046, "tick_s": 60,
    "upload_url": "https://www.tolley.io/api/heat/ingest",
    "commands_url": "https://www.tolley.io/api/heat/commands",
    "upload_enabled": False,
}


def load(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def atomic(path, obj):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(obj, f, allow_nan=False, indent=2); f.write("\n"); f.flush(); os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)


def config():
    c = DEFAULTS | (load(ROOT / "heatctl.json", {}) or {})
    if c["mode"] not in ("shadow", "live") or c["hvac_season"] not in ("heat", "cool"):
        raise ValueError("Invalid operating mode")
    for key in ("wake", "weekend_wake", "night", "earliest_warmup", "sun_off"):
        datetime.strptime(c[key], "%H:%M")
    for key in ("day_target", "raw_target", "wake_target", "cold_wake_target"):
        if not 60 <= float(c[key]) <= 73: raise ValueError("Comfort target outside bounds")
    if not 50 <= c["supp_idle"] <= c["supp_high"] <= c["nest_max"] <= 80: raise ValueError("Nest limits")
    if not 50 <= c["upstairs_floor"] <= c["honeywell_max"] <= 73: raise ValueError("Honeywell limits")
    if c["honeywell_min"] < 50 or c["nest_min"] < 50: raise ValueError("Minimum limits")
    if c["tick_s"] != 60: raise ValueError("Sensor/safety tick must stay 60 seconds")
    return c


def stamp(epoch): return datetime.fromtimestamp(epoch, TZ).isoformat()


def number(v):
    try:
        n = float(v)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError): return None


def epoch(v):
    try:
        dt = datetime.fromisoformat(v)
        return dt.timestamp() if dt.tzinfo else None
    except (ValueError, TypeError): return None


def fresh(t, now, max_age):
    t = number(t)
    return t is not None and 0 <= now - t <= max_age
