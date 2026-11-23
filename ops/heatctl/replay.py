"""Replay real sensor/heat-call observations; do not invent achieved temperatures."""
import csv
import json
from datetime import datetime
from pathlib import Path
from common import TZ,DEFAULTS,epoch,number,stamp
from planner import decide


def run(date="2026-11-23",home=Path.home()):
    updates=[]
    for row in csv.reader((home/"sensors/log.csv").open()):
        if len(row)<3 or row[1] not in ("couch","loft"):continue
        try:
            dt=datetime.fromisoformat(row[0])
            if dt.tzinfo is None:dt=dt.replace(tzinfo=TZ)
            data=json.loads(",".join(row[2:]));value=number(data.get("tC"))
            if value is not None and -40<=value<=85:updates.append((dt.timestamp(),row[1],value*1.8+32))
        except (ValueError,TypeError):continue
    updates.sort();pos=0;latest={};state={};records=[]
    for row in csv.DictReader((home/"humid/log.csv").open()):
        t=epoch(row.get("ts"))
        if t is None:continue
        dt=datetime.fromtimestamp(t,TZ)
        if dt.date().isoformat()!=date or not 3<=dt.hour<7:continue
        while pos<len(updates) and updates[pos][0]<=t:
            when,name,value=updates[pos];latest[name]=(when,value);pos+=1
        def temp(name):
            v=latest.get(name);return round(v[1],2) if v and 0<=t-v[0]<=900 else None
        actual={n:{"fresh":row.get(ok)=="True","calling":row.get(hvac,"").lower() in ("heat","heating"),
            "heat_sp":58 if n=="honeywell" else 70,"mode":"heat","fan":"auto","fan_running":False}
            for n,ok,hvac in (("honeywell","honeywell_ok","honeywell_hvac"),("nest","nest_ok","nest_hvac"))}
        obs={"sensors":{"living_f":temp("couch"),"loft_f":temp("loft"),"living_rh":number(row.get("kitchen_rh")),"loft_rh":None},
             "thermostats":actual,"humidifier":row.get("relay_on")=="True","loft_fan":False}
        outdoor=number(row.get("outdoor_f"))
        w={"outdoor_f":outdoor,"forecast_low_f":outdoor,"feels_f":None,"fresh":False,"hours":[]}
        event=decide(obs,w,{},state,{},DEFAULTS,t)
        records.append({"ts":stamp(t),"living_f":temp("couch"),"period":event["period"],
            "level":event["plan"]["escalation_level"],"warmup_start":event["plan"]["warmup_start"],
            "upstairs_proposal":event["devices"]["honeywell"]["after"],"nest_proposal":event["devices"]["nest"]["after"]})
    escalations=[r for r in records if r["level"]>=2]
    return {"date":date,"observations":len(records),"first_l2_or_l3":escalations[0] if escalations else None,
        "last_before_seven":records[-1] if records else None,
        "limits":"Real recorded room temperatures and heat calls. Historical thermostat setpoints are scenario defaults 58/70; forecast uses recorded outdoor temperature, not a recovered forecast. This verifies proposal timing, not counterfactual achieved comfort or gas savings."}


if __name__=="__main__":print(json.dumps(run(),indent=2))
