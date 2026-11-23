"""Single verified write path. Instantiated only after live cutover gates pass."""
import asyncio
from common import stamp


def changed(before, after):
    for k,v in after.items():
        actual=before.get(k)
        if k=="heat_sp":
            if actual is None or abs(actual-v)>0.4:return True
        elif str(actual).lower()!=str(v).lower():return True
    return False


class Actuator:
    def __init__(self, backend, sleep=asyncio.sleep, persist=None):
        self.backend=backend;self.sleep=sleep;self.persist=persist or (lambda state:None)

    async def apply(self, decision, state, cfg, now, emit):
        if cfg["mode"]!="live": return  # backend is never even read in shadow
        records=state.setdefault("actuator",{})
        large=False
        for name in ("honeywell","nest"):
            item=decision["devices"][name];desired=dict(item["after"]);old=item["before"]
            if not desired: item["write"]="skipped";continue
            if not old.get("fresh"): item["write"]="blocked_stale";continue
            if "heat_sp" in desired and not cfg[name+"_min"]<=desired["heat_sp"]<=cfg[name+"_max"]:
                item["write"]="blocked_bounds";continue
            if not changed(old,desired):item["write"]="skipped";continue
            rec=records.setdefault(name,{"writes":[]})
            rec["writes"]=[t for t in rec["writes"] if now-t<3600]
            critical=decision.get("safety",False)
            if not critical and ((rec["writes"] and now-rec["writes"][-1]<600) or len(rec["writes"])>=3):
                item["write"]="rate_limited";continue
            if not critical and now<rec.get("retry_after",0):item["write"]="retry_backoff";continue
            is_large="heat_sp" in desired and old.get("heat_sp") is not None and abs(desired["heat_sp"]-old["heat_sp"])>5
            if is_large and large:item["write"]="deferred_large_change";continue
            if is_large:large=True
            ok=False
            # Read before each send. Never blindly resend after an ambiguous timeout.
            for attempt,delay in enumerate((0,5,15),1):
                if delay:await self.sleep(delay)
                event={"kind":"write_attempt","device":name,"attempt":attempt,"desired":desired,
                       "decision_id":decision["id"],"mode":"live","season":cfg["hvac_season"]}
                try:
                    before=await self.backend.read_device(name)
                    if not before.get("fresh"):raise RuntimeError("fresh device read unavailable")
                    if changed(before,desired):
                        # Every actual send counts, even if its response times out.
                        if not critical and len(rec["writes"])>=3:raise RuntimeError("hourly write cap reached")
                        rec["writes"].append(now)
                        self.persist(state)
                        await self.backend.write_device(name,desired)
                        await self.sleep(20)
                        after=await self.backend.read_device(name)
                    else:after=before
                    if not after.get("fresh") or changed(after,desired):raise RuntimeError("readback mismatch")
                    ok=True;event.update(result="ok",readback_ok=True);item.update(write="ok",readback_ok=True)
                    state.setdefault("confirmed",{})[name]=desired;rec.update(failures=0,retry_after=0)
                except Exception as exc:
                    # Never include exception strings from cloud clients; they can contain credentials.
                    event.update(result="failed",readback_ok=False,error=type(exc).__name__)
                    item.update(write="failed",readback_ok=False,error=type(exc).__name__)
                item["attempts"]=attempt;emit(event)
                if ok:break
            if not ok:
                rec["failures"]=rec.get("failures",0)+1
                deficit=decision["plan"].get("target_f",0)-(decision["inputs"]["sensors"].get("living_f") or 0)
                rec["retry_after"]=now+(60 if critical or deficit>=0.5 else min(3600,900*2**(rec["failures"]-1)))
                if name=="honeywell":state.setdefault("honeywell_failure_since",now)
            elif name=="honeywell":state.pop("honeywell_failure_since",None)
        desired=decision["devices"]["humidifier"]["after"]
        try:
            await self.backend.humidifier(desired)
            decision["devices"]["humidifier"].update(write="ok",readback_ok=True)
        except Exception as exc:
            decision["devices"]["humidifier"].update(write="failed",readback_ok=False,error=type(exc).__name__)
