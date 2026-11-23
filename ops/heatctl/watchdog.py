"""Independent five-minute observation/alert path, shadow-safe by construction."""
import time
import asyncio
import fcntl
from common import ROOT,config,load,atomic,fresh,stamp
from observations import read
from journal import Journal


async def recover(cfg,alerts):
    if cfg["mode"]!="live" or not alerts:return "shadow_no_writes"
    from controller import cutover_ready
    cutover_ready(cfg)
    # Compete for the SAME controller and cloud-owner locks, never create a
    # second session while a running planner owns equipment.
    with (ROOT/"controller.lock").open("a") as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return "queued_for_active_owner"
        from io_live import HouseIO
        backend=HouseIO()
        try:
            await backend.poll()
            before=await backend.read_device("honeywell")
            if not before.get("fresh"):return "safe_write_blocked_no_fresh_read"
            await backend.write_device("honeywell",{"heat_sp":60,"mode":"heat","fan":"auto"})
            await asyncio.sleep(20)
            after=await backend.read_device("honeywell")
            if abs(after.get("heat_sp",-999)-60)>0.4 or after.get("fan")!="auto":return "safe_readback_failed"
            await backend.humidifier(False)
            return "safe_state_verified"
        finally:await backend.close()


def evaluate(obs,state,now):
    alerts=[];temp=obs["sensors"].get("living_f")
    if temp is not None and (temp<55 or temp>80):alerts.append("ROOM_TEMPERATURE_SAFETY")
    if temp is None:alerts.append("LIVING_SENSOR_STALE")
    if not fresh(state.get("tick_at"),now,600):alerts.append("PLANNER_STALE")
    for name,t in obs["thermostats"].items():
        age=t.get("age_s")
        if age is None or age>1800 or age<0:alerts.append(name.upper()+"_NO_READ_30M")
    return alerts


def main():
    now=time.time();cfg=config();state=load(ROOT/"state.json",{}) or {};obs=read(now,cfg)
    alerts=evaluate(obs,state,now)
    record={"kind":"watchdog","mode":cfg["mode"],"season":cfg["hvac_season"],"alerts":alerts,
            "reason_code":alerts[0] if alerts else "WATCHDOG_HEALTHY",
            "why":"Independent health check. Shadow never changes equipment.","safe_request":{"honeywell_heat_sp":60,"fan":"auto"} if alerts else None}
    if alerts:
        # Main live owner consumes this; systemd supervises restart. No competing TCC session.
        atomic(ROOT/"watchdog-request.json",{"ts":now,"alerts":alerts})
        try:record["why"]+=" Recovery: "+asyncio.run(recover(cfg,alerts))
        except Exception as exc:record["why"]+=" Recovery failed: "+type(exc).__name__
    atomic(ROOT/"watchdog-state.json",{"ts":stamp(now),**record})
    Journal().emit(record,now)


if __name__=="__main__":main()
