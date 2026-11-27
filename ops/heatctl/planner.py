"""Pure planning rules from the November 23 review. No I/O or device writes."""
import math
import copy
from datetime import datetime, timedelta
from common import TZ, stamp
from model import band, rate, combo
from humidity import decide as humidity_decide
import ownership


def at(dt, text):
    hour, minute = map(int, text.split(":"))
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0)


def raw_day(w):
    return ((w.get("outdoor_f") is not None and w["outdoor_f"] < 40)
        or (w.get("wind_mph") or 0) >= 12 or (w.get("gust_mph") or 0) >= 25
        or (w.get("precip_mm") or 0) > 0 or (w.get("cloud_pct") or 0) >= 80
        or (w.get("feels_f") is not None and w.get("outdoor_f") is not None and w["outdoor_f"]-w["feels_f"] >= 6))


def rh_target(outdoor):
    if outdoor is None: return 45
    for low,target in ((35,60),(20,50),(10,45),(0,40),(-999,35)):
        if outdoor >= low: return target


def decide(obs, weather, model, state, override, cfg, now):
    dt = datetime.fromtimestamp(now, TZ)
    wake = at(dt, cfg["weekend_wake"] if dt.weekday() >= 5 else cfg["wake"])
    night = at(dt, cfg["night"]); evening = at(dt,cfg["sun_off"])-timedelta(minutes=30)
    living, loft = obs["sensors"].get("living_f"), obs["sensors"].get("loft_f")
    raw = raw_day(weather)
    target = cfg["raw_target"] if raw else cfg["day_target"]
    wake_target = cfg["cold_wake_target"] if raw else cfg["wake_target"]
    if dt >= wake: wake += timedelta(days=1)
    # Tomorrow can have a different weekend schedule.
    wake = at(wake, cfg["weekend_wake"] if wake.weekday() >= 5 else cfg["wake"])
    # During the day, project cooling from tonight's setback, not all afternoon:
    # the existing daytime plan is assumed to maintain its comfort target.
    next_night=at(dt,cfg["night"])
    reference=next_night.timestamp() if at(dt,cfg["wake"])<=dt<next_night else now
    projected_start_f=min(living,target+cfg["evening_bump"]) if living is not None and reference>now else living
    hours = max(0,(wake.timestamp()-reference)/3600)
    forecast = [h for h in weather.get("hours",[]) if h["t"] <= wake.timestamp()]
    outdoor = min((h["outdoor_f"] for h in forecast if h.get("outdoor_f") is not None),default=weather.get("outdoor_f"))
    wb = band(outdoor)
    if outdoor is not None and outdoor < 40: wake_target = cfg["cold_wake_target"]
    warm_rate = max(0.25,rate(model,"warmup_rate","both|"+wb,2.1))
    cool_rate = max(0,rate(model,"cool_rate","blower_off|"+wb,0.9 if outdoor is not None and outdoor < 40 else 0.4))
    recovery_feels=min((h["feels_f"] for h in forecast if h.get("feels_f") is not None),default=weather.get("feels_f"))
    buffer = cfg["warmup_buffer_min"]/60 + (0.25 if recovery_feels is not None and recovery_feels<25 else 0)
    lead = max(0,(wake_target-projected_start_f+cool_rate*hours)/(warm_rate+cool_rate))+buffer if projected_start_f is not None else None
    start = max(wake-timedelta(hours=lead),at(wake,cfg["earliest_warmup"])) if lead is not None else None
    today_wake = at(dt,cfg["weekend_wake"] if dt.weekday()>=5 else cfg["wake"])
    period = "night" if dt < today_wake else "setback" if dt >= night else "evening" if dt >= evening else "day"
    if period=="night" and start and dt>=start: period="warmup"; target=wake_target
    if period=="evening": target=min(cfg["honeywell_max"],target+cfg["evening_bump"])
    solar = period=="day" and (weather.get("shortwave_wm2") or 0)>=300 and weather.get("cloud_pct",100) is not None and weather.get("cloud_pct",100)<35
    if solar and not raw: target=max(cfg["day_target"],target-cfg["solar_credit"])
    active = override if override and override.get("until",0)>now else {}
    if active.get("type") in ("warm","hold"): target=active["target_f"]
    housemode = state.get("housemode","home")
    if housemode=="away": period="away"
    if active.get("type") in ("warm","hold") and housemode!="away": period="day" if dt<evening else "evening"
    # Period identity handles night rollover and manual holds expiring at boundaries.
    period_id = dt.date().isoformat()+":"+period
    control_holds,component_changes=ownership.detect(state,obs,period_id,now)
    control_holds={**control_holds,**state.get("external_owners",{})}
    holds = dict(state.get("manual_holds",{})) if state.get("period_id")==period_id else {}
    changes=[]
    for name,current in obs["thermostats"].items():
        prev = (state.get("observed") or {}).get(name,{})
        sp=current.get("heat_sp"); old=prev.get("heat_sp")
        expected=(state.get("confirmed") or {}).get(name,{})
        if current["fresh"] and sp is not None:
            external = old is not None and sp>old+0.4 and abs(sp-expected.get("heat_sp",-999))>0.4
            baseline = not state.get("period_id") and not state.get("auto_resume") and period not in ("night","setback","away")
            if external or baseline:
                holds[name]=sp
                changes.append({"device":name,"type":"manual_raise" if external else "initial_setpoint_preserved",
                                "source":"external_unknown","before":old,"after":sp})
    need = None if living is None else target-living
    c=combo(obs); current_rate=max(0.1,rate(model,"warmup_rate",(c or "both")+"|"+band(weather.get("outdoor_f")),0.0 if c=="nest" else 2.1))
    eta = max(0,need)/current_rate*60 if need is not None else None
    level=0
    if need is not None and need>=0.5:
        level=1
        if need>=1.5 or eta>45:level=2
        if need>=3 or eta>90 or (weather.get("feels_f") is not None and weather["feels_f"]<20):level=3
    old_level=state.get("level",0) if state.get("period_id")==period_id else 0
    if need is not None and 0<need<0.5:level=max(level,old_level)
    night_sp=60 if weather.get("forecast_low_f") is not None and weather["forecast_low_f"]<15 else 58
    up={"heat_sp":target,"mode":"heat","fan":"auto"}
    nest={"heat_sp":cfg["supp_high"] if need is not None and need>=0.5 else cfg["supp_idle"],"mode":"HEAT"}
    if level==2: up["heat_sp"]=target+min(3,math.ceil(need))
    if level==3: up["heat_sp"]=cfg["honeywell_max"]
    if period in ("night","setback"):
        up["heat_sp"]=night_sp;nest={"mode":"OFF"};level=0;target=night_sp;eta=None
    if period=="away":
        up["heat_sp"]=50;nest={"mode":"OFF"};level=0;target=50;eta=None
    fallback=state.get("honeywell_failure_since")
    if fallback and now-fallback>=1800 and need is not None and need>=0.5 and period not in ("night","setback","away"):
        nest={"heat_sp":cfg["supp_high"],"mode":"HEAT"}
    for name,after in (("honeywell",up),("nest",nest)):
        if name in holds:
            after["heat_sp"]=max(after.get("heat_sp",holds[name]),holds[name]);after["mode"]="heat" if name=="honeywell" else "HEAT"
        if "heat_sp" in after:
            after["heat_sp"]=min(cfg[name+"_max"],max(cfg[name+"_min"],after["heat_sp"]))
        if holds.get(name,0)>cfg[name+"_max"]:
            after.pop("heat_sp",None) # do not lower an external raise or issue an out-of-bounds command
    cap=rh_target(weather.get("outdoor_f"));rh=obs["sensors"].get("living_rh")
    if rh is None:rh=obs["sensors"].get("loft_rh")
    heating=any(t.get("calling") is True for t in obs["thermostats"].values())
    last_heat=now if heating else state.get("last_heat",0)
    stove=bool(state.get("stove_until",0)>now)
    stove_fan=stove and state.get("stove_fan_hold") is True and period!="away"
    if stove_fan:up["fan"]="on"
    if "nest_fan_until" in state:
        fan_until=state["nest_fan_until"]
        nest["fan_timer"]="ON" if fan_until>now and period!="away" else "OFF"
        if nest["fan_timer"]=="ON":nest["fan_until"]=fan_until
    humidity=humidity_decide(obs,obs.get("blower",{}),weather.get("outdoor_f"),cfg,state.get("rh_held",False),now)
    held=humidity["rh_held"];stale_since=now if rh is not None else state.get("stale_rh_since",now)
    humid=humidity["after"];humid_reason=humidity["why"]
    gap=loft-living if loft is not None and living is not None else None
    loft_on=bool(gap is not None and (gap>=3 or (gap>1.5 and obs.get("loft_fan") is True)))
    if cfg["loft_quiet_hours"] and period in ("night","setback"):loft_on=False
    alarms=[]
    if living is None:alarms.append("LIVING_SENSOR_STALE")
    if any(not v["fresh"] for v in obs["thermostats"].values()):alarms.append("THERMOSTAT_STALE")
    if not weather.get("fresh"):alarms.append("FORECAST_UNAVAILABLE")
    if fallback and now-fallback>=1800:alarms.append("HONEYWELL_WRITE_FAILURE_30M")
    if period=="setback" and now-night.timestamp()>=900:
        current=obs["thermostats"]["honeywell"]
        if (("upstairs-temperature" not in control_holds and current.get("heat_sp")!=night_sp)
                or ("upstairs-fan" not in control_holds and current.get("fan")!=up["fan"])):
            alarms.append("SETBACK_NOT_CONFIRMED_15M")
    safety=living is not None and (living<55 or living>80)
    if safety:
        up={"heat_sp":60,"mode":"heat","fan":"auto"};nest={"mode":"OFF"} if living>80 else nest
        if "nest_fan_until" in state:nest.update(fan_timer="OFF");nest.pop("fan_until",None)
        humid=False;alarms.append("ROOM_TEMPERATURE_SAFETY")
    if living is None:up={};nest={};humid=False
    # A manual fan claim does not suppress heat settings on the same thermostat.
    # Explicit external ownership also applies during watchdog/safety requests.
    if not safety:
        up=ownership.filter_desired("honeywell",up,control_holds)
        nest=ownership.filter_desired("nest",nest,control_holds)
    else:
        up=ownership.filter_desired("honeywell",up,state.get("external_owners",{}))
        nest=ownership.filter_desired("nest",nest,state.get("external_owners",{}))
    devices={}
    for name,after in (("honeywell",up),("nest",nest)):
        before=obs["thermostats"][name]
        # No thermostat writes at all from stale data; independent watchdog can recover later.
        devices[name]={"before":before,"after":after if before["fresh"] else {},
            "write":"shadow" if cfg["mode"]=="shadow" else "pending", "attempts":0,"readback_ok":None,"error":None}
    devices.update(blower={"before":obs["thermostats"]["honeywell"].get("fan"),"after":devices["honeywell"]["after"].get("fan")},
                   humidifier={"before":obs.get("humidifier"),"after":humid,"why":humid_reason},
                   loft_fan={"observed":obs.get("loft_fan"),"after":loft_on,"owner":"loftfan.service"})
    projected=None
    if living is not None and start:
        cool_hours=max(0,min(hours,(start.timestamp()-reference)/3600))
        projected=round(projected_start_f-cool_hours*cool_rate+max(0,hours-cool_hours)*warm_rate,2)
    code="ROOM_TEMPERATURE_SAFETY" if safety else "INPUTS_UNAVAILABLE" if living is None else period.upper()+"_L"+str(level)
    def describe(after,name):
        if not after:
            if any(ownership.SCOPES[s][0]==name for s in control_holds):return "manual control; current settings preserved"
            return "no change while readings are unavailable"
        if str(after.get("mode","")).lower()=="off":return "off"
        return str(after["heat_sp"])+"°F" if "heat_sp" in after else "keep the current setpoint"
    why=(f"Living room {living}°F against a {target}°F {period} target. "
         f"Proposed upstairs setting: {describe(devices['honeywell']['after'],'honeywell')}; "
         f"Nest: {describe(devices['nest']['after'],'nest')}. Humidity: {humid_reason}.")
    if holds:why+=" Preserving previously raised setpoints until the next period; their source is unknown."
    if control_holds:why+=" Manual control: "+", ".join(control_holds)+". Other components remain automatic."
    result={"kind":"decision","mode":cfg["mode"],"season":cfg["hvac_season"],"period":period,
        "housemode":housemode,"occupancy":None,"override":active or {"type":"none"},
        "inputs":{"sensors":obs["sensors"],"blower":obs.get("blower",{}),"weather":weather,"learned":{"warmup_rate_both_fph":warm_rate,
            "cool_rate_fph":cool_rate,"model_version":model.get("version",0),
            "seeded":not bool(model.get("rates",{}).get("warmup_rate|both|"+wb)),
            "warmup_sample_n":model.get("rates",{}).get("warmup_rate|both|"+wb,{}).get("n",0)}},
        "plan":{"target_f":target,"wake":wake.isoformat(),"warmup_start":start.isoformat() if start else None,
            "wake_target_f":wake_target,"predicted_wake_f":projected,"escalation_level":level,"eta_min":eta,"rh_target":cap,
            "projection_start":stamp(reference),"projection_start_f":projected_start_f},
        "devices":devices,"reason_code":code,"why":why,"alerts":alarms,"manual_changes":changes+component_changes,
        "safety":safety,"stage":"unknown"}
    result["plan"].update(stove_until=state.get("stove_until"),stove_fan_hold=bool(stove_fan),nest_fan_until=state.get("nest_fan_until"))
    result["plan"]["manual_components"]=control_holds
    if cfg["hvac_season"]=="cool":
        for name in ("honeywell","nest"):result["devices"][name]["after"]={}
        result["devices"]["humidifier"]["after"]=False
        result["reason_code"]="COOLING_NOT_COMMISSIONED"
        result["why"]="Cooling schema supported; equipment and cooling policy need commissioning before control."
    state.update(period_id=period_id,manual_holds=holds,level=level,last_heat=last_heat,
        stale_rh_since=stale_since,rh_held=held,observed=copy.deepcopy(obs["thermostats"]))
    state.pop("auto_resume",None)
    return result
