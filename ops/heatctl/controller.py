#!/usr/bin/env python3
import argparse
import asyncio
import fcntl
import json
import signal
import subprocess
import time
import urllib.request
import uuid
from datetime import datetime,timedelta
from pathlib import Path
from common import ROOT,TZ,config,load,atomic,stamp,DEFAULTS,fresh
import observations,weather,model,planner,reports
import ownership
import fire_policy
from journal import Journal


def cutover_ready(cfg):
    if cfg["mode"]!="live":return
    gate=load(ROOT/"cutover.json",{}) or {}
    required=("owner_go","cloud_control_jobs_paused","cloud_nest_refresh_stopped","comfort_settings_confirmed","airflow_interlocks_reviewed","humidifier_device_id","nest_device_name")
    if not all(gate.get(k) for k in required):raise RuntimeError("Live blocked: cutover manifest incomplete")
    if gate.get("commissioning")!="passed":raise RuntimeError("Live blocked: device command checks have not passed")
    from acceptance import check
    # Owner can explicitly choose live learning instead of the waiting period.
    # This never waives writer ownership, identity, or airflow requirements.
    waiver=gate.get("shadow_wait_waiver",{})
    waived=waiver.get("approved") is True and bool(waiver.get("owner_instruction")) and bool(waiver.get("recorded_at"))
    if not waived and not check()["ready_for_owner_review"]:
        raise RuntimeError("Live blocked: shadow trial incomplete and no explicit owner waiting-period waiver")
    for unit in ("humid.service","fanctl.service"):
        r=subprocess.run(["systemctl","--user","is-active","--quiet",unit])
        if r.returncode==0:raise RuntimeError("Live blocked: legacy writer still active: "+unit)


def command(state,cmd,now):
    action=cmd["action"]
    if action in ("warm","hold"):
        hours=float(cmd.get("hours",2));target=float(cmd.get("target_f",71))
        if not 0.1<=hours<=24 or not 60<=target<=73:raise ValueError("Override outside bounds")
        state["override"]={"type":action,"target_f":target,"until":now+hours*3600}
    elif action=="auto":
        scope=cmd.get("component")
        if scope:
            if scope not in ownership.SCOPES:raise ValueError("Unknown component")
            state.setdefault("control_holds",{}).pop(scope,None)
            name=ownership.SCOPES[scope][0]
            if scope.endswith("temperature"):state.setdefault("manual_holds",{}).pop(name,None)
        else:
            state["override"]={};state["manual_holds"]={};state["control_holds"]={};state["auto_resume"]=True
    elif action in ("away","home"):state["housemode"]=action;state["override"]={}
    elif action=="stove":
        hours=float(cmd.get("hours",2))
        if not 0<=hours<=8:raise ValueError("Stove duration outside bounds")
        if type(cmd.get("fan_hold",False)) is not bool:raise ValueError("fan_hold must be boolean")
        state["stove_started_at"]=now
        state["stove_until"]=min(now+hours*3600,fire_policy.next_cutoff(now))
        state["stove_fan_hold"]=cmd.get("fan_hold",False) and hours>0
    elif action=="nest-fan":
        mode=cmd.get("fan","ON")
        hours=float(cmd.get("hours",2))
        if mode not in ("ON","OFF") or not 0<hours<=12:raise ValueError("Nest fan requires ON/OFF and 0 < hours <= 12")
        state["nest_fan_until"]=now+hours*3600 if mode=="ON" else 0
    else:raise ValueError("Unsupported command")


def commands(state,journal,cfg,now):
    directory=ROOT/"commands";directory.mkdir(exist_ok=True)
    for path in sorted(directory.glob("*.json")):
        cmd=load(path,{}) or {};cid=cmd.get("id")
        if not cid or journal.db.execute("SELECT 1 FROM commands WHERE id=?",(cid,)).fetchone():continue
        try:
            if now-cmd["created_at"]>600 or now<cmd["created_at"]:raise ValueError("expired")
            command(state,cmd,cmd["created_at"]);result="accepted_shadow" if cfg["mode"]=="shadow" else "accepted_live"
        except Exception:result="rejected"
        # Save state before acknowledgment. Reapplication uses fixed created_at for expiry.
        atomic(ROOT/"state.json",state)
        with journal.db:journal.db.execute("INSERT INTO commands VALUES(?,?)",(cid,result))
        journal.emit({"kind":"command_ack","command_id":cid,"result":result,"mode":cfg["mode"],"season":cfg["hvac_season"]},now)


def fetch_commands(cfg):
    if not cfg.get("upload_enabled"):return
    token=(Path.home()/"heatpush/token").read_text().strip()
    req=urllib.request.Request(cfg["commands_url"],headers={"Authorization":"Bearer "+token})
    try:
        with urllib.request.urlopen(req,timeout=10) as r:data=json.load(r)
        for cmd in data.get("commands",[]):
            cid=str(uuid.UUID(cmd["id"]))
            atomic(ROOT/"commands"/(cid+".json"),cmd)
    except Exception:pass


async def tick(state,cfg,journal,backend=None,dry=False):
    if backend:await backend.poll()
    # Polling creates new observation timestamps; freshness must use a time
    # AFTER the poll, otherwise every new live reading appears in the future.
    now=time.time()
    obs=observations.read(now,cfg)
    forecast=await asyncio.to_thread(weather.read,now,cfg,True)
    if forecast.get("outdoor_f") is None:forecast["outdoor_f"]=obs.get("outdoor_fallback")
    if not dry:commands(state,journal,cfg,now)
    fire_policy.prepare(state,now)
    state["external_owners"]=ownership.active(now)
    learned=load(ROOT/"model.json",{}) or {}
    updates=model.update(learned,obs,forecast,now)
    event=planner.decide(obs,forecast,learned,state,state.get("override",{}),cfg,now)
    if fire_policy.prepare(state,now):
        event["devices"]["honeywell"]["after"]["fan"]="auto"
        event["plan"]["manual_components"].pop("upstairs-fan",None)
        event["why"]+=" Nightly 1 AM fire cutoff: Honeywell fan AUTO pending verification; humidifiers follow fresh Honeywell blower status."
        event["alerts"].append("FIRE_CUTOFF_AUTO_PENDING")
    event["plan"].update(fire_cutoff_at=state.get("fire_cutoff_at"),next_fire_cutoff=stamp(fire_policy.next_cutoff(now)))
    event.update(id=str(uuid.uuid4()),ts=stamp(now))
    watchdog=load(ROOT/"watchdog-request.json",{}) or {}
    if cfg["mode"]=="live" and fresh(watchdog.get("ts"),now,360) and any(x in watchdog.get("alerts",[]) for x in ("ROOM_TEMPERATURE_SAFETY","PLANNER_STALE","HONEYWELL_NO_READ_30M","NEST_NO_READ_30M")):
        event["safety"]=True;event["devices"]["honeywell"]["after"]={"heat_sp":60,"mode":"heat","fan":"auto"}
        event["devices"]["blower"]["after"]="auto"
        if "nest_fan_until" in state:
            event["devices"]["nest"]["after"].update(fan_timer="OFF")
            event["devices"]["nest"]["after"].pop("fan_until",None)
        event["devices"]["humidifier"]["after"]=False
        event["reason_code"]="WATCHDOG_SAFE_REQUEST"
    # Filter again after watchdog overrides; a manual claim never stops reporting.
    protected=dict(state["external_owners"])
    if "ROOM_TEMPERATURE_SAFETY" not in event.get("alerts",[]) and "ROOM_TEMPERATURE_SAFETY" not in watchdog.get("alerts",[]):
        protected={**state.get("control_holds",{}),**protected}
    for name in ("honeywell","nest"):
        item=event["devices"][name]
        item["after"]=ownership.filter_desired(name,item["after"],protected)
    event["devices"]["blower"]["after"]=event["devices"]["honeywell"]["after"].get("fan")
    if dry:return event
    if backend:
        from actuator import Actuator
        await Actuator(backend,persist=lambda s:atomic(ROOT/"state.json",s)).apply(event,state,cfg,now,lambda e:journal.emit(e))
        await backend.publish(event)
    daily=reports.update(state,event,obs,cfg,now)
    event["counters_today"]={"read_failures":daily["read_failures"],"nest_satisfied_below_target_samples":daily["nest_satisfied_below_target_samples"]}
    journal.emit(event,now)
    for e in updates:journal.emit({**e,"mode":cfg["mode"],"season":cfg["hvac_season"]},now)
    if now-state.get("last_daily_emit",0)>=300:
        journal.emit({"kind":"daily_model","mode":cfg["mode"],"season":cfg["hvac_season"],"daily":daily},now)
        state["last_daily_emit"]=now
        atomic(ROOT/"reports"/(daily["date"]+".json"),daily)
    state.update(tick_at=now,last_decision=event,mode=cfg["mode"],season=cfg["hvac_season"])
    atomic(ROOT/"model.json",learned);atomic(ROOT/"state.json",state)
    return event


async def finish_fire_cutoff(state,cfg,journal,backend):
    """Prioritize only the fan before slow full-house polling, with normal caps."""
    now=time.time()
    from fireplace import finish
    fireplace_result=await asyncio.to_thread(finish,cfg,now)
    if fireplace_result and not fireplace_result["verified"]:
        journal.emit({"kind":"watchdog","mode":cfg["mode"],"season":cfg["hvac_season"],
            "reason_code":"FIREPLACE_CUTOFF_PENDING","alerts":["FIREPLACE_CUTOFF_PENDING"],
            "why":"Fireplace Blower OFF not verified; retry pending.","safe_request":fireplace_result})
    if not backend or cfg["mode"]!="live" or not fire_policy.prepare(state,now):return
    from actuator import Actuator
    obs=observations.read(now,cfg)
    direct=False
    try:
        before=await backend.read_device("honeywell")
        direct=True
    except Exception:
        before=obs["thermostats"]["honeywell"]
    event={"id":str(uuid.uuid4()),"kind":"decision","ts":stamp(now),"mode":"live","season":cfg["hvac_season"],
        "inputs":{"sensors":obs["sensors"]},"plan":{"target_f":obs["sensors"].get("living_f") or 60},
        "devices":{"honeywell":{"before":before,"after":{"fan":"auto"}},
                   "nest":{"before":{},"after":{}},"humidifier":{"after":False}},
        "why":"Nightly 1 AM fire cutoff: fan AUTO; humidity follows fresh Honeywell blower status.","alerts":[]}
    await Actuator(backend,persist=lambda s:atomic(ROOT/"state.json",s)).apply(event,state,cfg,now,lambda e:journal.emit(e))
    result=event["devices"]["honeywell"]
    verified=((result.get("readback_ok") is True and result.get("after",{}).get("fan")=="auto") or
        (direct and result.get("write")=="skipped" and before.get("fresh") and str(before.get("fan","")).lower()=="auto"))
    if verified:
        state["fire_fan_auto_pending"]=False;state["fire_fan_auto_verified_at"]=time.time()
        state.setdefault("control_holds",{}).pop("upstairs-fan",None)
        state.setdefault("confirmed",{}).setdefault("honeywell",{})["fan"]="auto"
    record={"kind":"watchdog","mode":"live","season":cfg["hvac_season"],
        "reason_code":"FIRE_CUTOFF_VERIFIED" if verified else "FIRE_CUTOFF_AUTO_PENDING",
        "alerts":[] if verified else ["FIRE_CUTOFF_AUTO_PENDING"],"why":event["why"],
        "safe_request":{"fan":"auto","cutoff_at":state["fire_cutoff_at"],"write":result.get("write")}}
    journal.emit(record)
    atomic(ROOT/"fire-cutoff-status.json",{**record,"ts":stamp(time.time()),"verified":bool(verified)})
    atomic(ROOT/"state.json",state)


async def run(once=False,dry=False):
    ROOT.mkdir(parents=True,exist_ok=True)
    with (ROOT/"controller.lock").open("a") as lock:
        if not dry:
            # A read-only poll may be finishing during startup. Wait for its
            # short-lived lock instead of crashing/restarting the control service.
            for attempt in range(181):
                try:
                    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);break
                except BlockingIOError:
                    if once or attempt==180:raise
                    await asyncio.sleep(1)
        cfg=config()
        if dry:cfg["mode"]="shadow"
        cutover_ready(cfg);backend=None
        if cfg["mode"]=="live":
            from io_live import HouseIO
            backend=HouseIO()
        journal=None if dry else Journal()
        state=load(ROOT/"state.json",{}) or {}
        stop=asyncio.Event();wake=asyncio.Event();loop=asyncio.get_running_loop()
        for sig in (signal.SIGTERM,signal.SIGINT):loop.add_signal_handler(sig,lambda:(stop.set(),wake.set()))
        loop.add_signal_handler(signal.SIGUSR1,wake.set)
        humidity_task=asyncio.create_task(backend.humidity_guard.run(stop)) if backend else None
        try:
            while not stop.is_set():
                started=time.monotonic()
                wake.clear()
                if not dry:await finish_fire_cutoff(state,cfg,journal,backend)
                if not dry:await asyncio.to_thread(fetch_commands,cfg)
                event=await tick(state,cfg,journal,backend,dry)
                if dry:print(json.dumps(event,indent=2));return
                if time.time()-state.get("last_upload",0)>=120:
                    await asyncio.to_thread(journal.send,cfg)
                    state["last_upload"]=time.time()
                if once:print(json.dumps(event,indent=2));return
                print(json.dumps({"ts":event["ts"],"mode":cfg["mode"],"reason":event["reason_code"],"target":event["plan"]["target_f"],"pending":journal.pending()}),flush=True)
                try:await asyncio.wait_for(wake.wait(),max(1,60-(time.monotonic()-started)))
                except asyncio.TimeoutError:pass
        finally:
            stop.set()
            if humidity_task:await humidity_task
            if backend:await backend.close()
            if journal:journal.db.close()


def main():
    p=argparse.ArgumentParser();p.add_argument("command",choices=["loop","once","dry","status","model","acceptance","warm","hold","auto","away","home","stove","nest-fan","mode","manual","owners"])
    p.add_argument("--fan-hold",action="store_true",help="Hold the upstairs blower ON during stove mode")
    p.add_argument("values",nargs="*");a=p.parse_args()
    if a.fan_hold and a.command!="stove":p.error("--fan-hold requires stove")
    if a.command in ("loop","once","dry"):asyncio.run(run(a.command=="once",a.command=="dry"));return
    if a.command=="acceptance":
        from acceptance import check
        print(json.dumps(check(),indent=2));return
    if a.command in ("status","model"):
        print(json.dumps(load(ROOT/("state.json" if a.command=="status" else "model.json"),{}),indent=2));return
    if a.command=="owners":print(json.dumps(ownership.active(),indent=2));return
    if a.command=="manual":
        if not 1<=len(a.values)<=2:p.error("manual COMPONENT [2h]; components: "+", ".join(ownership.SCOPES))
        hours=float(a.values[1].rstrip("h")) if len(a.values)>1 else None
        print(json.dumps(ownership.claim(a.values[0],hours),indent=2));return
    if a.command=="mode":
        if a.values!=["shadow"]:raise SystemExit("Live requires reviewed cutover.json and completed acceptance; use the cutover runbook.")
        c=config();c["mode"]="shadow";atomic(ROOT/"heatctl.json",c)
        subprocess.run(["systemctl","--user","restart","heatctl.service"],check=True)
        print("Shadow enabled. Existing cloud routines must be resumed separately during rollback.");return
    now=time.time();cmd={"id":str(uuid.uuid4()),"created_at":now,"action":a.command}
    if a.command=="auto" and a.values:
        if len(a.values)!=1:p.error("auto [COMPONENT]")
        cmd["component"]=a.values[0]
    if a.command in ("warm","hold"):
        cmd.update(target_f=float(a.values[0]) if a.values else 71,hours=float(a.values[1].rstrip("h")) if len(a.values)>1 else 2)
    if a.command=="stove":cmd.update(hours=float(a.values[0].rstrip("h")) if a.values else 2,fan_hold=a.fan_hold)
    if a.command=="nest-fan":
        if not 1<=len(a.values)<=2:p.error("use nest-fan on [2h] or nest-fan off")
        cmd.update(fan=a.values[0].upper(),hours=float(a.values[1].rstrip("h")) if len(a.values)>1 else 2)
    command({},cmd,now) # validate without changing the running controller
    if a.command=="auto" and a.values:ownership.release(a.values[0])
    atomic(ROOT/"commands"/(cmd["id"]+".json"),cmd)
    print("Queued "+a.command+" for next tick; current mode: "+config()["mode"])


if __name__=="__main__":main()
