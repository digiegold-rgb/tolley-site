"""Owner's nightly fire cutoff, using Chicago wall time (including DST)."""
from datetime import datetime,timedelta
from common import ROOT,TZ,load

SCOPES=("upstairs-fan","humidifier")


def next_cutoff(now):
    local=datetime.fromtimestamp(now,TZ)
    cutoff=local.replace(hour=1,minute=0,second=0,microsecond=0,fold=0)
    if cutoff.timestamp()<=now:cutoff+=timedelta(days=1)
    return cutoff.timestamp()


def latest_cutoff(now):
    local=datetime.fromtimestamp(now,TZ)
    cutoff=local.replace(hour=1,minute=0,second=0,microsecond=0,fold=0)
    if cutoff.timestamp()>now:cutoff-=timedelta(days=1)
    return cutoff.timestamp()


def policy():
    return load(ROOT/"fire-policy.json",{}) or {}


def due(now):
    p=policy();cutoff=latest_cutoff(now)
    return cutoff if p.get("enabled") is True and cutoff>=p.get("first_cutoff",float("inf")) else None


def claim_deadline(scope,since):
    p=policy()
    if scope not in SCOPES or p.get("enabled") is not True:return None
    return max(next_cutoff(since),p["first_cutoff"])


def prepare(state,now):
    """Idempotent catch-up after missed timers/restarts; never touches hardware."""
    cutoff=due(now)
    if cutoff is None:return False
    if cutoff>state.get("fire_cutoff_at",0):
        state["fire_cutoff_at"]=cutoff
        state["fire_fan_auto_pending"]=True
        state.pop("fire_fan_auto_verified_at",None)
        if state.get("stove_started_at",0)<=cutoff:
            state["stove_until"]=min(state.get("stove_until",cutoff),cutoff)
            state["stove_fan_hold"]=False
        for scope in SCOPES:
            hold=state.setdefault("control_holds",{}).get(scope,{})
            if hold.get("since",0)<=cutoff:state["control_holds"].pop(scope,None)
    # A stale observation must not recreate an old fan hold while AUTO is pending.
    if state.get("fire_fan_auto_pending"):
        state.setdefault("control_holds",{}).pop("upstairs-fan",None)
    return bool(state.get("fire_fan_auto_pending"))
