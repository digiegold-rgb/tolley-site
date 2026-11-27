"""Durable 01:00 CT request plus independent Fireplace Blower OFF."""
import json
import subprocess
import time
from common import ROOT,atomic,config,stamp
from fire_policy import due,next_cutoff
import fireplace


def request():
    now=time.time();cutoff=due(now)
    if cutoff is None:
        print(json.dumps({"next_cutoff":stamp(next_cutoff(now)),"due":False}));return
    atomic(ROOT/"fire-cutoff-request.json",{"cutoff_at":cutoff,"requested_at":stamp(now),
        "fan":"auto","humidifier":"follow_blower","fireplace_blower":"off"})
    fireplace_result=fireplace.finish(config(),now)
    if config()["mode"]=="live":
        was_active=subprocess.run(["systemctl","--user","is-active","--quiet","heatctl.service"]).returncode==0
        subprocess.run(["systemctl","--user","start","heatctl.service"],check=True)
        # A newly started controller checks catch-up itself. Do not signal it
        # before it has installed its handlers.
        if was_active:
            subprocess.run(["systemctl","--user","kill","--kill-whom=main","--signal=SIGUSR1","heatctl.service"],check=True)
    print(json.dumps({"cutoff_at":stamp(cutoff),"requested_at":stamp(now),"mode":config()["mode"],
        "fireplace_blower":fireplace_result}))
    if fireplace_result and not fireplace_result["verified"]:
        raise RuntimeError("Fireplace OFF pending; controller will retry")


if __name__=="__main__":request()
