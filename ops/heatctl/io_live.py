"""Prepared live adapter. No import-time network calls. Existing humid code is reused.

Only constructed once after humid.service/fanctl.service are stopped and the
cutover manifest has been approved. The legacy humid lock remains held throughout.
"""
import asyncio
import fcntl
import importlib.util
import json
import math
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from common import TZ, ROOT, load, atomic, epoch


class HouseIO:
    def __init__(self, read_only=False):
        self.read_only=read_only
        self.supports_fan_deadline=True;self.fan_command_deadline=None
        base=Path.home()/"humid"
        self.lock=(base/"humid.lock").open("a")
        fcntl.flock(self.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        import sys
        spec=importlib.util.spec_from_file_location("heatctl_legacy_humid",base/"humid.py")
        self.h=importlib.util.module_from_spec(spec);sys.modules[spec.name]=self.h;spec.loader.exec_module(self.h)
        self.cfg=self.h.load_config();self.password=self.h.load_tcc_password(Path(self.cfg["secrets_dir"]))
        from humidity import HumidityLoop, HUMIDIFIER_URL
        if self.cfg["shelly_url"].rstrip("/")!=HUMIDIFIER_URL:
            self.lock.close()
            raise RuntimeError("Only the pinned .36 humidifier relay may be controlled")
        self.humidity_guard=HumidityLoop(self);self.fast_humidity=True
        self.cfg["circulate_humidify"]=False
        # The legacy collector chooses the first Nest in the account. Live
        # control must observe the exact same pinned device that it commands.
        self.h.read_nest=self.read_nest
        self.hw=self.h.HoneywellSession();self.last=load(self.cfg['state_path'],{}) or None;self.auth_after=0
        # Preserve original timestamps across a supervised restart. Existing
        # freshness limits still expire these observations after five minutes.
        if self.last:self.h.EXTRA.update(self.last.get('thermostats',{}))

    def refresh_nest(self):
        base=Path(self.cfg["secrets_dir"]);tok=load(base/"nest_token.json",{})
        client=load(base/"nest_client.json",{})["web"]
        data=urllib.parse.urlencode({"client_id":client["client_id"],"client_secret":client["client_secret"],
            "refresh_token":tok["refresh_token"],"grant_type":"refresh_token"}).encode()
        with urllib.request.urlopen("https://oauth2.googleapis.com/token",data,timeout=20) as r:answer=json.load(r)
        tok.update(access_token=answer["access_token"],heatctl_expires_at=time.time()+answer.get("expires_in",3600))
        if answer.get("refresh_token"):tok["refresh_token"]=answer["refresh_token"]
        atomic(base/"nest_token.json",tok)

    def read_nest(self,cfg,secrets_dir):
        try:
            tok=load(Path(secrets_dir)/"nest_token.json",{})
            if tok.get("heatctl_expires_at",0)<time.time()+120:self.refresh_nest()
            try:data=self.nest_request()
            except urllib.error.HTTPError as exc:
                if exc.code!=401:raise
                self.refresh_nest();data=self.nest_request()
            traits=data["traits"];sp=traits.get("sdm.devices.traits.ThermostatTemperatureSetpoint",{}).get("heatCelsius")
            ambient=traits.get("sdm.devices.traits.Temperature",{}).get("ambientTemperatureCelsius")
            self.h.EXTRA["nest"]={"setpoint_f":sp*1.8+32 if sp is not None else None,
                "ambient_f":ambient*1.8+32 if ambient is not None else None,
                "mode":traits.get("sdm.devices.traits.ThermostatMode",{}).get("mode"),
                "eco":traits.get("sdm.devices.traits.ThermostatEco",{}).get("mode"),
                "fan_timer":traits.get("sdm.devices.traits.Fan",{}).get("timerMode"),
                "fan_until":epoch(traits.get("sdm.devices.traits.Fan",{}).get("timerTimeout")),"t":time.time()}
            return traits["sdm.devices.traits.ThermostatHvac"]["status"],""
        except Exception as exc:return None,type(exc).__name__

    async def poll(self):
        self.last=await self.h.one_tick(self.cfg,self.hw,self.password,dry_run=True,prev=self.last)
        if self.hw.device:
            self.last["thermostats"]["honeywell"]["ambient_f"]=self.hw.device.current_temperature
        # Expose fresh observations to the planner. Publish the canonical
        # control reason and one CSV row only after the live action/readback.
        self.previous=load(self.cfg["state_path"],{})
        self.h.write_state(Path(self.cfg["state_path"]),self.last)
        return self.last

    async def publish(self,decision):
        item=decision["devices"]["humidifier"]
        if item.get("readback_ok"):
            self.last["relay_on"]=item["after"]
        else:
            try:self.last["relay_on"]=self.h.relay_is_on(await asyncio.to_thread(self.h.shelly_status,self.cfg["shelly_url"]))
            except Exception:self.last["relay_on"]=None
        heating=any(str(self.last.get(k,"")).lower() in ("heat","heating","auxheat") for k in ("honeywell_hvac","nest_hvac"))
        prefix="heating:heatctl" if item["after"] and heating else "circulate:heatctl_honeywell" if item["after"] else "heatctl"
        self.last.update(want_on=item["after"],applied=item["after"] if item.get("readback_ok") else None,
            reason=prefix+": "+item["why"],override="heatctl",target_rh=decision["plan"]["rh_target"],
            max_rh=decision["plan"]["rh_target"],controller="heatctl")
        self.last=self.h.maybe_log_and_save(self.cfg,self.last,self.previous)

    def nest_request(self, command=None, params=None):
        if command and getattr(self,"read_only",False):raise RuntimeError("Read-only collector cannot command Nest")
        manifest=load(ROOT/"cutover.json",{})
        name=manifest.get("nest_device_name","")
        if not name.startswith("enterprises/"+self.cfg["nest_project_id"]+"/devices/"):
            raise RuntimeError("Verified Nest identity missing from cutover")
        tok=load(Path(self.cfg["secrets_dir"])/"nest_token.json",{})
        url="https://smartdevicemanagement.googleapis.com/v1/"+name
        data=None
        if command:
            url+=":executeCommand";data=json.dumps({"command":command,"params":params or {}}).encode()
        req=urllib.request.Request(url,data=data,headers={"Authorization":"Bearer "+tok["access_token"],"Content-Type":"application/json"})
        with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)

    async def read_device(self,name):
        if name=="honeywell":
            if self.hw.device is None:raise RuntimeError("persistent TCC session unavailable")
            await asyncio.wait_for(self.hw.device.refresh(),45)
            d=self.hw.device
            return {"fresh":True,"heat_sp":d.setpoint_heat,"mode":d.system_mode,"fan":d.fan_mode}
        traits=(await asyncio.to_thread(self.nest_request))["traits"]
        sp=traits.get("sdm.devices.traits.ThermostatTemperatureSetpoint",{}).get("heatCelsius")
        return {"fresh":True,"heat_sp":sp*1.8+32 if sp is not None else None,
                "mode":traits.get("sdm.devices.traits.ThermostatMode",{}).get("mode"),
                "fan_timer":traits.get("sdm.devices.traits.Fan",{}).get("timerMode"),
                "fan_until":epoch(traits.get("sdm.devices.traits.Fan",{}).get("timerTimeout"))}

    async def write_device(self,name,desired):
        if getattr(self,"read_only",False):raise RuntimeError("Read-only collector cannot write equipment")
        from ownership import active,filter_desired
        desired=filter_desired(name,desired,active())
        if not desired:return
        if name=="honeywell":
            d=self.hw.device
            if d is None:raise RuntimeError("No persistent TCC session")
            if desired.get("mode") and str(d.system_mode).lower()!=desired["mode"].lower():
                await asyncio.wait_for(d.set_system_mode(desired["mode"]),45)
            if "heat_sp" in desired and abs(d.setpoint_heat-desired["heat_sp"])>0.4:
                # TCC rejects hold deadlines between quarter-hour boundaries.
                # Round up so the temporary hold lasts at least two hours.
                requested=datetime.now(TZ)+timedelta(hours=2)
                deadline=requested.replace(minute=(requested.minute//15)*15,second=0,microsecond=0)
                if deadline<requested:deadline+=timedelta(minutes=15)
                until=deadline.time()
                await asyncio.wait_for(d.set_hold_heat(until,temperature=desired["heat_sp"]),45)
            if desired.get("fan") and d.fan_mode!=desired["fan"]:
                deadline=getattr(self,"fan_command_deadline",None)
                if str(desired["fan"]).lower()=="on" and deadline is not None and time.time()>=deadline:
                    raise RuntimeError("Stove fan ON request expired at nightly cutoff")
                await asyncio.wait_for(d.set_fan_mode(desired["fan"]),45)
        else:
            traits=(await asyncio.to_thread(self.nest_request))["traits"]
            current_mode=traits.get("sdm.devices.traits.ThermostatMode",{}).get("mode")
            mode=desired.get("mode",current_mode)
            fan=desired.get("fan_timer")
            if fan is not None and (fan not in ("ON","OFF") or "sdm.devices.traits.Fan" not in traits):
                raise RuntimeError("Nest fan capability unavailable or invalid mode")
            eco=traits.get("sdm.devices.traits.ThermostatEco",{}).get("mode")
            if current_mode!=mode:
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatMode.SetMode",{"mode":mode})
            # Some Nest models reject redundant Eco commands. If Eco must be
            # exited, HEAT must be established first (OFF forbids that command).
            if ("mode" in desired or "heat_sp" in desired) and mode=="HEAT" and eco=="MANUAL_ECO":
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatEco.SetMode",{"mode":"OFF"})
            if mode=="HEAT" and "heat_sp" in desired:
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat",{"heatCelsius":(desired["heat_sp"]-32)/1.8})
            if fan is not None:
                params={"timerMode":fan}
                if fan=="ON":
                    seconds=math.ceil(desired["fan_until"]-time.time())
                    if not 1<=seconds<=43200:raise ValueError("Nest fan deadline outside bounds")
                    params["duration"]=str(seconds)+"s"
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.Fan.SetTimer",params)

    async def humidifier(self,on):
        if getattr(self,"read_only",False):raise RuntimeError("Read-only collector cannot write equipment")
        # Main planner never renews ON leases. Only the fast local loop can do so.
        if on:
            row=await self.humidity_guard.step()
            if not row.get("readback_ok") or row.get("observed") is not True:
                raise RuntimeError("Power-based humidification was not permitted or verified")
        else:
            async with self.humidity_guard.lock:
                await self.humidity_guard.relay(False)
                self.humidity_guard.latest={"observed_at":time.time(),"after":False,"observed":False,
                    "why":"controller safety or shutdown","write":"ok","readback_ok":True}

    async def close(self):
        await self.hw.close();self.lock.close()
