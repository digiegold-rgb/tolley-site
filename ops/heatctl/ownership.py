"""Independent manual ownership for each thermostat function and humidifier.

Claim before an external manual writer starts; release only that claim afterward.
The registry never sends hardware commands. Missing registry means all automatic;
an unreadable existing registry blocks automatic writes instead of dropping holds.
"""
import fcntl
import json
import math
import time
from common import ROOT, atomic
import fire_policy

SCOPES={
    "upstairs-temperature":("honeywell",("heat_sp","mode")),
    "upstairs-fan":("honeywell",("fan",)),
    "downstairs-temperature":("nest",("heat_sp","mode")),
    "downstairs-fan":("nest",("fan_timer","fan_until")),
    "humidifier":("humidifier",()),
}


def registry():
    path=ROOT/"ownership.json"
    try:
        data=json.loads(path.read_text())
        if not isinstance(data,dict):raise ValueError("Invalid ownership registry")
        for scope,row in data.items():
            if scope not in SCOPES or not isinstance(row,dict):raise ValueError("Invalid owner")
            for key in ("until","released_at"):
                if row.get(key) is not None and (type(row[key]) not in (int,float) or not math.isfinite(row[key])):raise ValueError("Invalid ownership timestamp")
        return data
    except FileNotFoundError:return {}


def active(now=None):
    now=time.time() if now is None else now
    try:
        result={}
        for scope,row in registry().items():
            if row.get("released_at"):continue
            deadline=fire_policy.claim_deadline(scope,row.get("since",now))
            until=row.get("until")
            if deadline is not None:until=deadline if until is None else min(until,deadline)
            if until is None or until>now:result[scope]={**row,"until":until}
        return result
    except (OSError,ValueError,TypeError):
        return {s:{"owner":"ownership unavailable","until":None} for s in SCOPES}


def claim(scope,hours=None,owner="manual"):
    if scope not in SCOPES:raise ValueError("Unknown component: "+scope)
    if hours is not None and not 0<hours<=24:raise ValueError("Manual duration must be >0 and <=24 hours")
    now=time.time()
    with (ROOT/"ownership.lock").open("a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        rows=registry();rows[scope]={"owner":owner,"since":now,"until":now+hours*3600 if hours is not None else None}
        atomic(ROOT/"ownership.json",rows)
    return rows[scope]


def release(scope):
    if scope not in SCOPES:raise ValueError("Unknown component: "+scope)
    with (ROOT/"ownership.lock").open("a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        rows=registry();rows[scope]={"released_at":time.time()}
        atomic(ROOT/"ownership.json",rows)


def filter_desired(name,desired,holds):
    result=dict(desired)
    for scope,(device,fields) in SCOPES.items():
        if device==name and scope in holds:
            for field in fields:result.pop(field,None)
    return result


def different(a,b,key):
    if a is None or b is None:return False
    if key=="heat_sp":return abs(a-b)>0.4
    if key=="fan_until":return abs(a-b)>60
    return str(a).lower()!=str(b).lower()


def detect(state,obs,period_id,now):
    """Changes in either direction belong only to the affected function.

    Temperature holds end at the next schedule period. Fan holds persist until
    the owner selects AUTO/OFF or explicitly releases them. A native Nest timer
    also expires on its own deadline. Never infer ownership from stale reads.
    """
    holds=dict(state.get("control_holds",{}));changes=[]
    for scope,(name,fields) in SCOPES.items():
        if name=="humidifier":continue
        row=holds.get(scope)
        if row and ((row.get("period_id") and row["period_id"]!=period_id) or (row.get("until") and row["until"]<=now)):
            holds.pop(scope,None)
        current=obs["thermostats"].get(name,{})
        if not current.get("fresh"):continue
        previous=state.get("observed",{}).get(name,{})
        expected=state.get("confirmed",{}).get(name,{})
        keys=("fan_timer",) if scope=="downstairs-fan" else fields
        changed=[key for key in keys if different(current.get(key),previous.get(key),key)
                 and (key not in expected or different(current.get(key),expected.get(key),key))]
        if changed:
            row={"owner":"external manual change","since":now,"fields":list(fields)}
            if scope.endswith("temperature"):row["period_id"]=period_id
            if scope=="downstairs-fan":row["until"]=current.get("fan_until")
            holds[scope]=row;changes.append({"device":name,"type":"manual_component","component":scope,"source":"external_unknown"})
        if scope=="upstairs-fan" and str(current.get("fan","")).lower()=="auto":holds.pop(scope,None)
        if scope=="downstairs-fan" and str(current.get("fan_timer","")).upper()=="OFF":holds.pop(scope,None)
    state["control_holds"]=holds
    return holds,changes
