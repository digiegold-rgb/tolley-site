"""Shadow reads existing telemetry only: no TCC logins, SDM calls or token access."""
from pathlib import Path
from common import load, number, epoch, fresh


def read(now, cfg, home=None):
    home = Path(home or Path.home())
    raw = load(home / "sensors/latest.json", {}) or {}
    hs = load(home / "humid/state.json", {}) or {}
    lf = load(home / "loftfan/state.json", {}) or {}
    result = {"sensors": {}, "thermostats": {}, "humidifier": None, "loft_fan": None}
    for key, name in (("couch", "living"), ("loft", "loft")):
        record = raw.get(key) or {}
        for field, suffix, limit in (("tC", "f", cfg["sensor_max_age_s"]), ("rh", "rh", 1200)):
            value, at = number(record.get(field)), epoch(record.get(field + "_ts"))
            good = value is not None and (-40 <= value <= 85 if field == "tC" else 0 <= value <= 100)
            good = good and fresh(at, now, limit)
            result["sensors"][name + "_" + suffix] = round(value * 1.8 + 32, 2) if good and field == "tC" else value if good else None
            result["sensors"][name + "_" + suffix + "_ts"] = at
            result["sensors"][name + "_" + suffix + "_age_s"] = round(now-at) if at else None
    for name, hvac_key, ok_key in (("honeywell", "honeywell_hvac", "honeywell_ok"), ("nest", "nest_hvac", "nest_ok")):
        t = (hs.get("thermostats") or {}).get(name) or {}
        valid = fresh(t.get("t"), now, cfg["thermostat_max_age_s"])
        calling = None
        if valid and hs.get(ok_key) and fresh(epoch(hs.get("ts")), now, 180):
            calling = str(hs.get(hvac_key, "")).lower() in ("heat", "heating", "auxheat")
        result["thermostats"][name] = {"heat_sp": number(t.get("setpoint_f")),
            "mode": t.get("mode"), "fan": t.get("fan_mode"), "fan_running": t.get("fan_running"),
            "ambient_f": number(t.get("ambient_f")), "calling": calling, "fresh": valid,
            "age_s": round(now-t["t"]) if number(t.get("t")) is not None else None,
            "observed_at": t.get("t"), "stage": "unknown"}
    if fresh(epoch(hs.get("ts")), now, 180):
        result["humidifier"] = hs.get("relay_on")
        result["outdoor_fallback"] = number(hs.get("outdoor_f"))
    if fresh(lf.get("epoch"), now, 180):
        result["loft_fan"] = lf.get("observed_on")
        result["loft_watts"] = number(lf.get("watts"))
    result["humid_learning"] = load(home / "humid/learned.json", {}) or {}
    return result
