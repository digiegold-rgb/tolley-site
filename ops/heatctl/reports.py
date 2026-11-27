from datetime import datetime
from common import TZ, stamp
from savings import update as update_savings


def update(state,event,obs,cfg,now):
    date=datetime.fromtimestamp(now,TZ).date().isoformat()
    daily=state.get("daily",{})
    if daily.get("date")!=date:
        daily={"date":date,"season":cfg["hvac_season"],"coverage_h":0,"upstairs_h":0,"nest_h":0,
            "blower_only_h":0,"humid_h":0,"loft_fan_h":0,"loft_kwh":0,"below_target_min":0,
            "nest_runtime_below_target_h":0,"nest_satisfied_below_target_samples":0,
            "wake_actual_f":None,"wake_prediction_f":None,"wake_error_f":None,
            "first_arrival":None,"stage":"unknown","cost_basis":"runtime × input-rating estimate",
            "humidity_basis":"2 × 90W, 2 × 3.5 gal/h estimates","read_failures":0,"watchdog_alerts":0}
    previous=state.get("last_report")
    if daily.get("blower_source")!="honeywell_fan_status":
        daily["blower_only_h"]=0
        daily["blower_source"]="honeywell_fan_status"
        daily["blower_coverage_since"]=stamp(now)
        daily["blower_correction"]="Earlier .151 power/runtime belongs to Fireplace Blower, not furnace."
    if previous and previous.get("date")==date and 0<now-previous["t"]<=180:
        h=(now-previous["t"])/3600;old=previous["obs"];old_event=previous["event"]
        up=old["thermostats"]["honeywell"].get("calling");down=old["thermostats"]["nest"].get("calling")
        if up is not None and down is not None:
            daily["coverage_h"]+=h;daily["upstairs_h"]+=h*bool(up);daily["nest_h"]+=h*bool(down)
            daily["blower_only_h"]+=h*bool(old.get("blower",{}).get("source")=="honeywell_fan_status" and old.get("blower",{}).get("valid") and old.get("blower",{}).get("running") and not up)
        if old.get("humidifier") is True:daily["humid_h"]+=h
        if old.get("loft_fan") is True:
            daily["loft_fan_h"]+=h
            if old.get("loft_watts") is not None:daily["loft_kwh"]+=h*old["loft_watts"]/1000
        living=old["sensors"].get("living_f");target=old_event["plan"]["target_f"]
        if living is not None and old_event["period"] in ("day","evening"):
            if living<target-1:daily["below_target_min"]+=h*60
            if living<target:
                if down:daily["nest_runtime_below_target_h"]+=h
                elif down is False:daily["nest_satisfied_below_target_samples"]+=1
    if event["period"]=="warmup" and not daily.get("wake_prediction_at"):
        daily["wake_prediction_f"]=event["plan"].get("predicted_wake_f")
        daily["wake_prediction_at"]=stamp(now)
    dt=datetime.fromtimestamp(now,TZ);wake=cfg["weekend_wake"] if dt.weekday()>=5 else cfg["wake"]
    wh,wm=map(int,wake.split(":"));minutes=dt.hour*60+dt.minute-wh*60-wm
    if 0<=minutes<=10 and daily["wake_actual_f"] is None and obs["sensors"].get("living_f") is not None:
        daily["wake_actual_f"]=obs["sensors"]["living_f"]
        daily["wake_sample_ts"]=obs["sensors"].get("living_f_ts")
        if daily["wake_prediction_f"] is not None:daily["wake_error_f"]=daily["wake_actual_f"]-daily["wake_prediction_f"]
    if 0<=minutes and daily["first_arrival"] is None and obs["sensors"].get("living_f") is not None and obs["sensors"]["living_f"]>=event["plan"]["target_f"]-0.5:
        daily["first_arrival"]=stamp(now)
    daily["read_failures"]+=sum(not x["fresh"] for x in obs["thermostats"].values())
    daily["gas_ccf_low"]=(daily["upstairs_h"]*.84+daily["nest_h"]*.4)/1.037
    daily["gas_ccf_high"]=(daily["upstairs_h"]*1.2+daily["nest_h"]*.4)/1.037
    daily["gas_usd_low"]=daily["gas_ccf_low"]*cfg["gas_usd_per_ccf"]
    daily["gas_usd_high"]=daily["gas_ccf_high"]*cfg["gas_usd_per_ccf"]
    daily["humid_kwh"]=daily["humid_h"]*.18;daily["humid_usd"]=daily["humid_kwh"]*cfg["electric_usd_per_kwh"]
    daily["humid_water_gal"]=daily["humid_h"]*7
    daily["humid_water_usd"]=daily["humid_water_gal"]*cfg["water_usd_per_gal"] if cfg["water_usd_per_gal"] is not None else None
    daily["loft_usd"]=daily["loft_kwh"]*cfg["electric_usd_per_kwh"]
    # The former meter was the fireplace. Never carry its totals as furnace data.
    for key in ("blower_h","blower_observed_h","furnace_kwh","blower_watts","blower_thresholds_provisional"):
        daily.pop(key,None)
    daily["comparison_note"]=("Live control: compare predictions with actual measurements; early learning remains provisional."
        if cfg["mode"]=="live" else "Shadow plans are compared against observed existing controls; predictions are not achieved outcomes.")
    update_savings(daily,previous,event,obs,cfg,now)
    state["daily"]=daily
    state["last_report"]={"date":date,"t":now,"obs":obs,"event":{"period":event["period"],"plan":event["plan"]}}
    return daily
