"""Elapsed-time gates are measured from persisted shadow observations, not assertions."""
import json
import sqlite3
import time
from collections import Counter
from datetime import datetime
from common import ROOT,TZ


def check(now=None,root=ROOT):
    now=time.time() if now is None else now
    result={"elapsed_days":0,"complete_observation_days":0,"cold_mornings":0,"ready_for_owner_review":False}
    path=root/"events.sqlite"
    if not path.exists():return result
    db=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True)
    days=Counter();cold=Counter();first=None
    try:
        for ts,text in db.execute("SELECT ts,payload FROM events ORDER BY seq"):
            e=json.loads(text)
            if e.get("kind")!="decision" or e.get("mode")!="shadow":continue
            if first is None:first=ts
            dt=datetime.fromtimestamp(ts,TZ)
            if e.get("reason_code")=="INPUTS_UNAVAILABLE" or "THERMOSTAT_STALE" in e.get("alerts",[]):continue
            days[dt.date().isoformat()]+=1
            outdoor=e.get("inputs",{}).get("weather",{}).get("outdoor_f")
            if 3<=dt.hour<7 and outdoor is not None and outdoor<40:cold[dt.date().isoformat()]+=1
    finally:db.close()
    result.update(elapsed_days=round((now-first)/86400,3) if first else 0,
        complete_observation_days=sum(n>=1000 for n in days.values()),cold_mornings=sum(n>=120 for n in cold.values()))
    result["ready_for_owner_review"]=result["elapsed_days"]>=5 and result["complete_observation_days"]>=5 and result["cold_mornings"]>=3
    result["live_comfort_acceptance"]="Pending: two weeks after approved cutover"
    result["cloud_write_readback_acceptance"]="Pending live observation; shadow cannot prove a write landed"
    return result


if __name__=="__main__":print(json.dumps(check(),indent=2))
