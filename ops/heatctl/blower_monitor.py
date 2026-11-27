"""Independent read-only power logging; safe to run during manual HVAC ownership."""
import argparse
import fcntl
import json
import signal
import threading
import time
from datetime import datetime, timedelta
from common import ROOT, TZ, atomic, config, load, stamp
from blower import BlowerSensor, POLL_S
from journal import Journal
from observations import read


def classify(row, obs):
    if not row.get("valid"):return "unknown"
    up=obs["thermostats"]["honeywell"]
    if up.get("fresh") and up.get("calling") is True:return "heat_call"
    if row["watts"] <= row["off_w"]:return "idle_candidate"
    if up.get("fresh") and up.get("calling") is False and up.get("fan_running") is True:return "fan_only"
    return "unclassified"


def accumulate(previous, row, daily):
    now=row["observed_at"];date=datetime.fromtimestamp(now,TZ).date().isoformat()
    if daily.get("date") != date:
        daily={"date":date,"observed_h":0.0,"blower_h":0.0,"furnace_kwh":0.0,"samples":0,"invalid_samples":0}
    elapsed=now-previous.get("observed_at",now)
    if previous.get("valid") and row.get("valid") and 0 < elapsed <= 30:
        midnight=datetime.fromtimestamp(now,TZ).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
        h=(now-max(now-elapsed,midnight))/3600
        daily["observed_h"]+=h
        daily["blower_h"]+=h*bool(previous.get("running"))
        daily["furnace_kwh"]+=h*previous["watts"]/1000
    daily["samples"]+=1
    daily["invalid_samples"]+=int(not row.get("valid"))
    return daily


def calibration_update(summary, row):
    if not row.get("valid"):return summary
    key=row["calibration_state"];g=summary.setdefault(key,{"n":0,"min_w":row["watts"],"max_w":row["watts"],"mean_w":0})
    g["n"]+=1;g["min_w"]=min(g["min_w"],row["watts"]);g["max_w"]=max(g["max_w"],row["watts"])
    g["mean_w"]+=(row["watts"]-g["mean_w"])/g["n"];g["last_at"]=row["ts"]
    return summary


def run(once=False, upload=False):
    raise RuntimeError("Retired: .151 is Fireplace Blower, not a furnace meter; leave this service disabled")
    with (ROOT/"blower-monitor.lock").open("a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        sensor=BlowerSensor();stop=threading.Event()
        for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,lambda *_:stop.set())
        previous=load(ROOT/"blower.json",{}) or {}
        daily=previous.get("daily",{});summary=load(ROOT/"blower-calibration.json",{}) or {}
        journal_root=ROOT/"blower-events";journal=Journal(journal_root)
        def uploader():
            outgoing=Journal(journal_root)
            try:
                while not stop.is_set():
                    outgoing.send(config())
                    stop.wait(120)
            finally:outgoing.db.close()
        thread=threading.Thread(target=uploader,daemon=True) if upload else None
        if thread:thread.start()
        last_emit=0
        try:
            while not stop.is_set():
                started=time.monotonic();row=sensor.sample();cfg=config()
                row["calibration_state"]=classify(row,read(row["observed_at"],cfg))
                daily=accumulate(previous,row,daily);row["daily"]=daily
                calibration_update(summary,row)
                atomic(ROOT/"blower.json",row);atomic(ROOT/"blower-calibration.json",summary)
                path=ROOT/"blower-logs"/(row["ts"][:10]+".jsonl");path.parent.mkdir(exist_ok=True)
                with path.open("a") as log:log.write(json.dumps(row,allow_nan=False)+"\n")
                if row["observed_at"]-last_emit>=60 or (row["running"],row["valid"],row["calibration_state"]) != (previous.get("running"),previous.get("valid"),previous.get("calibration_state")):
                    journal.emit({"kind":"blower_sample","mode":"shadow","season":cfg["hvac_season"],
                                  "inputs":{"blower":row},"daily":daily,
                                  "why":"Read-only furnace power measurement; airflow thresholds remain provisional."},row["observed_at"])
                    last_emit=row["observed_at"]
                previous=row
                if once:print(json.dumps(row,indent=2));break
                stop.wait(max(0,POLL_S-(time.monotonic()-started)))
        finally:
            stop.set();journal.db.close()
            if thread:thread.join(timeout=25)


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--once",action="store_true");parser.add_argument("--upload",action="store_true")
    args=parser.parse_args();run(args.once,args.upload)
