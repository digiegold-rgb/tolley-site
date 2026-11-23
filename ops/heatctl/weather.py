import json
import urllib.request
import urllib.parse
from common import ROOT, load, atomic, fresh, epoch, number


def read(now, cfg, fetch=True):
    path = ROOT / "weather.json"
    cached = load(path, {}) or {}
    if not fresh(cached.get("fetched_at"), now, 900) and fetch:
        params = {"latitude": cfg["latitude"], "longitude": cfg["longitude"],
            "temperature_unit": "fahrenheit", "wind_speed_unit": "mph", "timezone": "UTC",
            "forecast_days": 2, "timeformat": "unixtime",
            "current": "temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation,shortwave_radiation",
            "hourly": "temperature_2m,apparent_temperature,wind_speed_10m,cloud_cover,shortwave_radiation",
            "daily": "sunrise,sunset"}
        try:
            with urllib.request.urlopen("https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params), timeout=12) as r:
                data = json.load(r)
            cached = {"fetched_at": now, "data": data}; atomic(path, cached)
        except Exception:
            pass  # age is reported; old forecasts never silently become fresh
    good = fresh(cached.get("fetched_at"), now, 3600)
    data = cached.get("data", {}) if good else {}
    cur, hourly = data.get("current", {}), data.get("hourly", {})
    out = {dst: number(cur.get(src)) for src,dst in (
        ("temperature_2m", "outdoor_f"), ("apparent_temperature", "feels_f"),
        ("wind_speed_10m", "wind_mph"), ("wind_gusts_10m", "gust_mph"),
        ("cloud_cover", "cloud_pct"), ("precipitation", "precip_mm"), ("shortwave_radiation", "shortwave_wm2"))}
    hours = []
    for i,t in enumerate(hourly.get("time", [])):
        if now <= t <= now+24*3600:
            hours.append({"t": t, "outdoor_f": number(hourly.get("temperature_2m", [])[i]),
                          "feels_f": number(hourly.get("apparent_temperature", [])[i])})
    temps = [x["outdoor_f"] for x in hours if x["outdoor_f"] is not None]
    out.update(forecast_low_f=min(temps) if temps else None, hours=hours, fresh=good,
               fetched_at=cached.get("fetched_at"), source="open-meteo" if good else "unavailable")
    return out
