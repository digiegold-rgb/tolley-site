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
from datetime import datetime, timedelta
from pathlib import Path
from common import TZ, ROOT, load


class HouseIO:
    def __init__(self):
        base=Path.home()/"humid"
        self.lock=(base/"humid.lock").open("a")
        fcntl.flock(self.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        import sys
        spec=importlib.util.spec_from_file_location("heatctl_legacy_humid",base/"humid.py")
        self.h=importlib.util.module_from_spec(spec);sys.modules[spec.name]=self.h;spec.loader.exec_module(self.h)
        self.cfg=self.h.load_config();self.password=self.h.load_tcc_password(Path(self.cfg["secrets_dir"]))
        self.hw=self.h.HoneywellSession();self.last=None;self.auth_after=0

    async def poll(self):
        self.last=await self.h.one_tick(self.cfg,self.hw,self.password,dry_run=True,prev=self.last)
        if self.hw.device:
            self.last["thermostats"]["honeywell"]["ambient_f"]=self.hw.device.current_temperature
        self.last=self.h.maybe_log_and_save(self.cfg,self.last,load(self.cfg["state_path"],{}))
        return self.last

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
            if mode=="HEAT":await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatEco.SetMode",{"mode":"OFF"})
            await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatMode.SetMode",{"mode":mode})
            if mode=="HEAT" and "heat_sp" in desired:
                await asyncio.to_thread(self.nest_request,"sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat",{"heatCelsius":(desired["heat_sp"]-32)/1.8})

    async def humidifier(self,on):
        expected=load(ROOT/"cutover.json",{}).get("humidifier_device_id")
        info=await asyncio.to_thread(self.h.shelly_rpc,self.cfg["shelly_url"],"Shelly.GetDeviceInfo")
        if not expected or info.get("id")!=expected:raise RuntimeError("Humidifier identity not verified")
        if on:await asyncio.to_thread(self.h.shelly_on,self.cfg["shelly_url"],600)
        else:await asyncio.to_thread(self.h.shelly_off,self.cfg["shelly_url"])
        actual=await asyncio.to_thread(self.h.shelly_status,self.cfg["shelly_url"])
        if actual.get("output") is not on:raise RuntimeError("Humidifier readback failed")
        if on and actual.get("timer_duration")!=600:
            await asyncio.to_thread(self.h.shelly_off,self.cfg["shelly_url"])
            raise RuntimeError("Humidifier lease missing")

    async def close(self):
        await self.hw.close();self.lock.close()
