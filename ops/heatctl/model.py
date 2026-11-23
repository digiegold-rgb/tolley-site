"""Conservative, observed-condition learning. Never learns from proposed commands."""
from common import number


def band(outdoor):
    if outdoor is None: return "unknown"
    for lo,label in ((40,">=40F"),(30,"30-40F"),(20,"20-30F"),(10,"10-20F")):
        if outdoor >= lo: return label
    return "<10F"


def combo(obs):
    up, down = [obs["thermostats"][n].get("calling") for n in ("honeywell", "nest")]
    if up is None or down is None: return None
    return "both" if up and down else "upstairs" if up else "nest" if down else "off"


def rate(model, name, key, default):
    return (model.get("rates", {}).get(name + "|" + key) or {}).get("value", default)


def update(model, obs, weather, now):
    model.setdefault("rates", {}); model.setdefault("version", 0)
    b, c = band(weather.get("outdoor_f")), combo(obs)
    s = obs["sensors"]; temp = s.get("living_f"); rh = s.get("living_rh")
    blower = obs["thermostats"]["honeywell"].get("fan_running")
    key = [c, b, blower, obs.get("humidifier")]
    previous, window = model.get("last"), model.get("window")
    valid = c is not None and b != "unknown" and temp is not None
    # A new temperature must arrive before an update. A stable stale reading is not learning.
    if not valid or not previous or not 0 < now-previous["t"] <= 180 or previous["key"] != key:
        window = None
    changes = []
    if valid:
        current = {"t": now, "temp": temp, "rh": rh, "temp_ts": s.get("living_f_ts"),
                   "rh_ts": s.get("living_rh_ts"), "key": key}
        if window and now-window["t"] >= 900 and current["temp_ts"] > window["temp_ts"]:
            hours = (current["temp_ts"]-window["temp_ts"])/3600
            if 0.1 <= hours <= 1:
                observed = (temp-window["temp"])/hours
                params = []
                if c != "off" and -2 <= observed <= 8: params.append(("warmup_rate", c+"|"+b, observed))
                if c == "nest" and -2 <= observed <= 8: params.append(("nest_effect", b, observed))
                if c == "off" and -5 <= observed <= 2:
                    params.append(("cool_rate", ("blower_on" if blower else "blower_off")+"|"+b, max(0,-observed)))
                if rh is not None and window["rh"] is not None and current["rh_ts"] > (window["rh_ts"] or 0):
                    rh_hours = (current["rh_ts"]-window["rh_ts"])/3600
                    rv = (rh-window["rh"])/rh_hours if rh_hours > 0 else 100
                    if abs(rv) <= 15:
                        params.append(("rh_rise" if obs.get("humidifier") else "rh_decay", c+"|"+b, rv))
                for name,k,v in params:
                    old = model["rates"].get(name+"|"+k)
                    value = round(v if not old else 0.8*old["value"]+0.2*v, 4)
                    entry = {"value": value, "n": 1+(old or {}).get("n",0)}
                    model["rates"][name+"|"+k] = entry; model["version"] += 1
                    changes.append({"kind": "learned", "param": name, "key": k, **entry,
                                    "prev_value": (old or {}).get("value"), "model_version": model["version"]})
            window = None
        model["window"] = window or current; model["last"] = current
    else:
        model["window"] = None; model["last"] = None
    return changes
