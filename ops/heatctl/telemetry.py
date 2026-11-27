"""Keep observations and uploads alive while the control service is stopped.

Uses the controller lock and a read-only adapter, never the actuator, command
queue, or humidity loop. Control state and proposed actions are not applied.
"""
import asyncio
import copy
import fcntl
import json
import signal
import time
from common import ROOT, atomic, config, load, stamp
from io_live import HouseIO
from journal import Journal
import observations, planner, weather


async def collect(session=None):
    session={} if session is None else session
    with (ROOT/"controller.lock").open("a") as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            backend=session.pop("backend",None)
            if backend:await backend.close()
            return None
        backend=session.get("backend")
        try:
            if backend:
                fcntl.flock(backend.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            else:
                backend=HouseIO(read_only=True);session["backend"]=backend
            await asyncio.wait_for(backend.poll(),90)
            # Preserve actual relay observations, not the legacy proposed action.
            backend.last.update(want_on=None,applied=None,override="observe",
                controller="heatctl-telemetry",reason="Read-only reporting; automatic controller stopped")
            backend.h.maybe_log_and_save(backend.cfg,backend.last,backend.previous)
        except Exception as exc:
            atomic(ROOT/"telemetry-read-status.json",{"ts":stamp(time.time()),"error":type(exc).__name__})
            if backend:await backend.close()
            session.pop("backend",None);backend=None
        finally:
            # Keep a persistent cloud session without reserving equipment ownership
            # between samples. A running controller takes the same two locks.
            if backend:fcntl.flock(backend.lock,fcntl.LOCK_UN)
        now=time.time();cfg=config();obs=observations.read(now,cfg)
        forecast=await asyncio.to_thread(weather.read,now,cfg,True)
        state=copy.deepcopy(load(ROOT/"state.json",{}) or {})
        event=planner.decide(obs,forecast,load(ROOT/"model.json",{}) or {},state,{},cfg|{"mode":"shadow"},now)
        event["reason_code"]="REPORTING_ONLY"
        event["why"]="Live observations continue while automatic control is stopped. No equipment commands are sent by this reporter."
        event["override"]={"type":"reporting only"}
        for name in ("honeywell","nest"):
            event["devices"][name].update(after={},write="observe_only")
        event["devices"]["humidifier"].update(after=obs.get("humidifier"),write="observe_only",why="Actual relay observation; no command")
        event["devices"]["blower"]["after"]=None
        event["plan"]["reporting_only"]=True
        event["plan"]["predicted_wake_f"]=None
        event["plan"]["warmup_start"]=None
        event["ts"]=stamp(now)
        return event


async def run():
    stop=asyncio.Event();loop=asyncio.get_running_loop()
    for sig in (signal.SIGTERM,signal.SIGINT):loop.add_signal_handler(sig,stop.set)
    journal=Journal(ROOT/"telemetry-events");session={}
    try:
        while not stop.is_set():
            started=time.monotonic()
            event=await collect(session)
            if event:
                journal.emit(event)
                atomic(ROOT/"telemetry-status.json",{"ts":event["ts"],"read_only":True,"sensors":event["inputs"]["sensors"]})
            await asyncio.to_thread(journal.send,config())
            try:await asyncio.wait_for(stop.wait(),max(1,60-(time.monotonic()-started)))
            except asyncio.TimeoutError:pass
    finally:
        if session.get("backend"):await session["backend"].close()
        journal.db.close()


if __name__=="__main__":asyncio.run(run())
