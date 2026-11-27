"""Fast humidity policy and a single serialized, identity-pinned relay writer."""
import asyncio
import time
from common import ROOT, atomic, config, fresh, load
from blower import BlowerSensor, airflow
from observations import read
import weather
import ownership

POLL_S, LEASE_S = 10, 30
HUMIDIFIER_URL = "http://192.168.2.36"


def target(outdoor):
    if outdoor is None:return 45
    for low,rh in ((35,60),(20,50),(10,45),(0,40),(-999,35)):
        if outdoor>=low:return rh


def decide(obs, blower, outdoor, cfg, held=False, now=None):
    now=time.time() if now is None else now
    cap=target(outdoor);rh=obs["sensors"].get("living_rh")
    if rh is None:rh=obs["sensors"].get("loft_rh")
    if rh is not None:
        if rh>=cap:held=True
        elif rh<=cap-cfg["rh_hysteresis"]:held=False
    room=obs["sensors"].get("living_f")
    reason="fresh Honeywell blower running status; humidity below target"
    on=True
    if not airflow(blower,now):on=False;reason="Honeywell blower stopped, unknown or stale"
    elif rh is None or held:on=False;reason="humidity target reached or humidity unavailable"
    elif room is None or room<55 or room>80:on=False;reason="room temperature unavailable or outside safety bounds"
    elif cfg["hvac_season"]!="heat":on=False;reason="cooling not commissioned"
    return {"after":on,"why":reason,"rh_target":cap,"rh":rh,"rh_held":held}


class HumidityLoop:
    def __init__(self, backend, sensor=None):
        self.backend=backend;self.sensor=sensor or BlowerSensor()
        self.lock=asyncio.Lock();self.latest={};self.held=False

    async def relay(self,on):
        if getattr(self.backend,"read_only",False) is True:raise RuntimeError("Read-only collector cannot write relay")
        if on and "humidifier" in ownership.active():raise RuntimeError("Humidifier has a manual owner")
        # Fail before ANY network write if the configured target changes.
        # In particular, .151 is never passed to a generic Shelly write helper.
        url=self.backend.cfg["shelly_url"].rstrip("/")
        if url != HUMIDIFIER_URL:
            raise RuntimeError("Humidifier writer requires the pinned .36 relay URL")
        expected=load(ROOT/"cutover.json",{}).get("humidifier_device_id")
        rpc=self.backend.h.shelly_rpc
        info=await asyncio.to_thread(rpc,url,"Shelly.GetDeviceInfo",timeout=3)
        if not expected or info.get("id")!=expected:raise RuntimeError("Humidifier identity not verified")
        params={"id":0,"on":on}
        if on:params["toggle_after"]=LEASE_S
        await asyncio.to_thread(rpc,url,"Switch.Set",params,timeout=3)
        status=await asyncio.to_thread(rpc,url,"Switch.GetStatus",{"id":0},timeout=3)
        if status.get("output") is not on or (on and status.get("timer_duration")!=LEASE_S):
            await asyncio.to_thread(rpc,url,"Switch.Set",{"id":0,"on":False},timeout=3)
            raise RuntimeError("Humidifier output or 30-second lease not verified")

    async def step(self,force_off=False):
        async with self.lock:
            blower=await asyncio.to_thread(self.sensor.sample)
            now=time.time();cfg=config();obs=read(now,cfg)
            outside=weather.read(now,cfg,False).get("outdoor_f")
            if outside is None:outside=obs.get("outdoor_fallback")
            item=decide(obs,blower,outside,cfg,self.held,now);self.held=item["rh_held"]
            watchdog=load(ROOT/"watchdog-request.json",{}) or {}
            if fresh(watchdog.get("ts"),now,360) and "ROOM_TEMPERATURE_SAFETY" in watchdog.get("alerts",[]):
                force_off=True
            if force_off:item.update(after=False,why="controller safety or shutdown")
            if cfg["mode"]!="live":item.update(after=False,why="controller not live")
            row={**item,"observed_at":now,"blower":blower,"readback_ok":False,"observed":None}
            try:
                status=await asyncio.to_thread(self.backend.h.shelly_rpc,HUMIDIFIER_URL,
                    "Switch.GetStatus",{"id":0},timeout=3)
                # An OFF before our verified ON lease expires is a manual stop.
                # Timer expiry, downtime and uncertain writes do not imply intent.
                if ("humidifier" not in ownership.active(now) and status.get("output") is False
                        and status.get("source")!="timer" and self.latest.get("observed") is True
                        and self.latest.get("readback_ok") is True
                        and fresh(self.latest.get("observed_at"),now,LEASE_S-10)):
                    ownership.claim("humidifier",2,owner="external manual OFF")
                if "humidifier" in ownership.active(now) and not force_off and item["after"]:
                    row.update(after=None,write="manual",readback_ok=False,
                        observed=status.get("output") if type(status.get("output")) is bool else None,
                        why="Humidifier manually owned; other controls and reporting continue")
                elif cfg["mode"]=="live" or force_off:
                    await self.relay(item["after"])
                    row.update(write="ok",readback_ok=True,observed=item["after"])
                else:row["write"]="shadow"
            except Exception as exc:
                row.update(write="failed",error=type(exc).__name__)
            self.latest=row
            atomic(ROOT/"humidity-fast.json",row)
            return row

    async def run(self,stop):
        while not stop.is_set():
            started=time.monotonic()
            try:await self.step()
            except Exception as exc:
                self.latest={"observed_at":time.time(),"after":False,"observed":None,"readback_ok":False,
                             "write":"failed","error":type(exc).__name__,"why":"fast humidity check failed"}
                # No renewed lease on failure; .36 turns itself off after <=30s.
                atomic(ROOT/"humidity-fast.json",self.latest)
            try:await asyncio.wait_for(stop.wait(),max(0.1,POLL_S-(time.monotonic()-started)))
            except asyncio.TimeoutError:pass
