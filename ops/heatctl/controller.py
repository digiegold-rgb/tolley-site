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
from journal import Journal


def cutover_ready(cfg):
    if cfg["mode"]!="live":return
    gate=load(ROOT/"cutover.json",{}) or {}
    required=("owner_go","cloud_control_jobs_paused","cloud_nest_refresh_stopped","shadow_acceptance_passed","comfort_settings_confirmed","airflow_interlocks_reviewed","humidifier_device_id","nest_device_name")
    if not all(gate.get(k) for k in required):raise RuntimeError("Live blocked: cutover manifest incomplete")
    from acceptance import check
    if not check()["ready_for_owner_review"]:raise RuntimeError("Live blocked: five shadow days and three cold mornings not yet observed")
    for unit in ("humid.service","fanctl.service"):
        r=subprocess.run(["systemctl","--user","is-active","--quiet",unit])
        if r.returncode==0:raise RuntimeError("Live blocked: legacy writer still active: "+unit)


def command(state,cmd,now):
    action=cmd["action"]
    if action in ("warm","hold"):
        hours=float(cmd.get("hours",2));target=float(cmd.get("target_f",71))
        if not 0.1<=hours<=24 or not 60<=target<=73:raise ValueError("Override outside bounds")
        state["override"]={"type":action,"target_f":target,"until":now+hours*3600}
    elif action=="auto":state["override"]={};state["manual_holds"]={};state["auto_resume"]=True
    elif action in ("away","home"):state["housemode"]=action;state["override"]={}
    elif action=="stove":
        hours=float(cmd.get("hours",2))
        if not 0<=hours<=8:raise ValueError("Stove duration outside bounds")
        state["stove_until"]=now+hours*3600
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
    now=time.time()
    if backend:await backend.poll()
    obs=observations.read(now,cfg)
    forecast=await asyncio.to_thread(weather.read,now,cfg,True)
    if forecast.get("outdoor_f") is None:forecast["outdoor_f"]=obs.get("outdoor_fallback")
    if not dry:commands(state,journal,cfg,now)
    learned=load(ROOT/"model.json",{}) or {}
    updates=model.update(learned,obs,forecast,now)
    event=planner.decide(obs,forecast,learned,state,state.get("override",{}),cfg,now)
    event.update(id=str(uuid.uuid4()),ts=stamp(now))
    watchdog=load(ROOT/"watchdog-request.json",{}) or {}
    if cfg["mode"]=="live" and fresh(watchdog.get("ts"),now,360) and any(x in watchdog.get("alerts",[]) for x in ("ROOM_TEMPERATURE_SAFETY","PLANNER_STALE","HONEYWELL_NO_READ_30M","NEST_NO_READ_30M")):
        event["safety"]=True;event["devices"]["honeywell"]["after"]={"heat_sp":60,"mode":"heat","fan":"auto"}
        event["devices"]["humidifier"]["after"]=False
        event["reason_code"]="WATCHDOG_SAFE_REQUEST"
    if dry:return event
    if backend:
        from actuator import Actuator
        await Actuator(backend,persist=lambda s:atomic(ROOT/"state.json",s)).apply(event,state,cfg,now,lambda e:journal.emit(e))
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


async def run(once=False,dry=False):
    ROOT.mkdir(parents=True,exist_ok=True)
    with (ROOT/"controller.lock").open("a") as lock:
        if not dry:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        cfg=config()
        if dry:cfg["mode"]="shadow"
        cutover_ready(cfg);backend=None
        if cfg["mode"]=="live":
            from io_live import HouseIO
            backend=HouseIO()
        journal=None if dry else Journal()
        state=load(ROOT/"state.json",{}) or {}
        stop=asyncio.Event();loop=asyncio.get_running_loop()
        for sig in (signal.SIGTERM,signal.SIGINT):loop.add_signal_handler(sig,stop.set)
        try:
            while not stop.is_set():
                started=time.monotonic()
                if not dry:await asyncio.to_thread(fetch_commands,cfg)
                event=await tick(state,cfg,journal,backend,dry)
                if dry:print(json.dumps(event,indent=2));return
                if time.time()-state.get("last_upload",0)>=120:
                    await asyncio.to_thread(journal.send,cfg)
                    state["last_upload"]=time.time()
                if once:print(json.dumps(event,indent=2));return
                print(json.dumps({"ts":event["ts"],"mode":cfg["mode"],"reason":event["reason_code"],"target":event["plan"]["target_f"],"pending":journal.pending()}),flush=True)
                try:await asyncio.wait_for(stop.wait(),max(1,60-(time.monotonic()-started)))
                except asyncio.TimeoutError:pass
        finally:
            if backend:await backend.close()
            if journal:journal.db.close()


def main():
    p=argparse.ArgumentParser();p.add_argument("command",choices=["loop","once","dry","status","model","acceptance","warm","hold","auto","away","home","stove","mode"])
    p.add_argument("values",nargs="*");a=p.parse_args()
    if a.command in ("loop","once","dry"):asyncio.run(run(a.command=="once",a.command=="dry"));return
    if a.command=="acceptance":
        from acceptance import check
        print(json.dumps(check(),indent=2));return
    if a.command in ("status","model"):
        print(json.dumps(load(ROOT/("state.json" if a.command=="status" else "model.json"),{}),indent=2));return
    if a.command=="mode":
        if a.values!=["shadow"]:raise SystemExit("Live requires reviewed cutover.json and completed acceptance; use the cutover runbook.")
        c=config();c["mode"]="shadow";atomic(ROOT/"heatctl.json",c)
        subprocess.run(["systemctl","--user","restart","heatctl.service"],check=True)
        print("Shadow enabled. Existing cloud routines must be resumed separately during rollback.");return
    now=time.time();cmd={"id":str(uuid.uuid4()),"created_at":now,"action":a.command}
    if a.command in ("warm","hold"):
        cmd.update(target_f=float(a.values[0]) if a.values else 71,hours=float(a.values[1].rstrip("h")) if len(a.values)>1 else 2)
    if a.command=="stove":cmd["hours"]=float(a.values[0].rstrip("h")) if a.values else 2
    command({},cmd,now) # validate without changing the running controller
    atomic(ROOT/"commands"/(cmd["id"]+".json"),cmd)
    print("Queued "+a.command+" for next tick; current mode: "+config()["mode"])


if __name__=="__main__":main()
