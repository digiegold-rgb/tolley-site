"""Prepared live adapter. No import-time network calls. Existing humid code is reused.

Only constructed once after humid.service/fanctl.service are stopped and the
cutover manifest has been approved. The legacy humid lock remains held throughout.
"""
import asyncio
import fcntl
import importlib.util
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from common import TZ, ROOT, load, atomic


class HouseIO:
    def __init__(self):
        base=Path.home()/"humid"
        self.lock=(base/"humid.lock").open("a")
        fcntl.flock(self.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        import sys
        spec=importlib.util.spec_from_file_location("heatctl_legacy_humid",base/"humid.py")
        self.h=importlib.util.module_from_spec(spec);sys.modules[spec.name]=self.h;spec.loader.exec_module(self.h)
        self.cfg=self.h.load_config();self.password=self.h.load_tcc_password(Path(self.cfg["secrets_dir"]))
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
                "fan_timer":traits.get("sdm.devices.traits.Fan",{}).get("timerMode"),"t":time.time()}
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
        prefix="heating:heatctl" if item["after"] and heating else "circulate:heatctl_stove" if item["after"] and item["why"]=="stove" else "heatctl"
        self.last.update(want_on=item["after"],applied=item["after"] if item.get("readback_ok") else None,
            reason=prefix+": "+item["why"],override="heatctl",target_rh=decision["plan"]["rh_target"],
            max_rh=decision["plan"]["rh_target"],controller="heatctl")
        self.last=self.h.maybe_log_and_save(self.cfg,self.last,self.previous)

    def nest_request(self, command=None, params=None):
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
                "mode":traits.get("sdm.devices.traits.ThermostatMode",{}).get("mode")}

    async def write_device(self,name,desired):
        if name=="honeywell":
            d=self.hw.device
            if d is None:raise RuntimeError("No persistent TCC session")
            if desired.get("mode") and str(d.system_mode).lower()!=desired["mode"].lower():
                await asyncio.wait_for(d.set_system_mode(desired["mode"]),45)
            if "heat_sp" in desired and abs(d.setpoint_heat-desired["heat_sp"])>0.4:
                until=(datetime.now(TZ)+timedelta(hours=2)).time().replace(second=0,microsecond=0)
                await asyncio.wait_for(d.set_hold_heat(until,temperature=desired["heat_sp"]),45)
            if desired.get("fan") and d.fan_mode!=desired["fan"]:
                await asyncio.wait_for(d.set_fan_mode(desired["fan"]),45)
        else:
            mode=desired.get("mode","HEAT")
            traits=(await asyncio.to_thread(self.nest_request))["traits"]
            current_mode=traits.get("sdm.devices.traits.ThermostatMode",{}).get("mode")
            eco=traits.get("sdm.devices.traits.ThermostatEco",{}).get("mode")
            if current_mode!=mode:
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatMode.SetMode",{"mode":mode})
            # Some Nest models reject redundant Eco commands. If Eco must be
            # exited, HEAT must be established first (OFF forbids that command).
            if mode=="HEAT" and eco=="MANUAL_ECO":
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatEco.SetMode",{"mode":"OFF"})
            if mode=="HEAT" and "heat_sp" in desired:
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat",{"heatCelsius":(desired["heat_sp"]-32)/1.8})

    async def humidifier(self,on):
        expected=load(ROOT/"cutover.json",{}).get("humidifier_device_id")
        info=await asyncio.to_thread(self.h.shelly_rpc,self.cfg["shelly_url"],"Shelly.GetDeviceInfo")
        if not expected or info.get("id")!=expected:raise RuntimeError("Humidifier identity not verified")
        if on:
            # Thermostat writes/readbacks may have stopped the blower since
            # planning. Recheck actual airflow immediately before energizing.
            if self.hw.device is None:
                await asyncio.to_thread(self.h.shelly_off,self.cfg["shelly_url"])
                raise RuntimeError("Upstairs airflow unavailable")
            try:
                await asyncio.wait_for(self.hw.device.refresh(),45)
                if self.hw.device.fan_running is not True:raise RuntimeError("Upstairs airflow not confirmed")
            except Exception:
                await asyncio.to_thread(self.h.shelly_off,self.cfg["shelly_url"])
                raise
            await asyncio.to_thread(self.h.shelly_on,self.cfg["shelly_url"],600)
        else:await asyncio.to_thread(self.h.shelly_off,self.cfg["shelly_url"])
        actual=await asyncio.to_thread(self.h.shelly_status,self.cfg["shelly_url"])
        if actual.get("output") is not on:raise RuntimeError("Humidifier readback failed")
        if on and actual.get("timer_duration")!=600:
            await asyncio.to_thread(self.h.shelly_off,self.cfg["shelly_url"])
            raise RuntimeError("Humidifier lease missing")

    async def close(self):
        await self.hw.close();self.lock.close()
