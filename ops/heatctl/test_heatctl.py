import asyncio
import copy
import json
import tempfile
import io
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock,Mock,patch
from common import DEFAULTS,TZ
import planner,model,observations,reports,watchdog
from controller import command,cutover_ready
from actuator import Actuator
from journal import Journal


def timestamp(s="2026-11-23T06:32:00"):return datetime.fromisoformat(s).replace(tzinfo=TZ).timestamp()


def fixture(temp=62.1):
    obs={"sensors":{"living_f":temp,"loft_f":temp+4 if temp is not None else None,"living_rh":40,"loft_rh":42,
        "living_f_ts":timestamp(),"living_rh_ts":timestamp()},
        "thermostats":{n:{"heat_sp":sp,"mode":"heat","fan":"auto","fan_running":True,
            "fresh":True,"calling":True,"age_s":0} for n,sp in (("honeywell",68),("nest",70))},
        "humidifier":False,"loft_fan":False,"loft_watts":0}
    w={"outdoor_f":28,"feels_f":20,"wind_mph":10,"gust_mph":15,"cloud_pct":60,
       "precip_mm":0,"shortwave_wm2":0,"forecast_low_f":25,"fresh":True,"hours":[]}
    return obs,w


def decision(temp=62.1,t=None,state=None,override=None,cfg=None):
    o,w=fixture(temp)
    return planner.decide(o,w,{},state if state is not None else {},override or {},cfg or dict(DEFAULTS),t or timestamp())


class PlannerTests(unittest.TestCase):
    def test_cold_morning_escalates_before_seven(self):
        d=decision();self.assertEqual(d["period"],"warmup");self.assertEqual(d["plan"]["escalation_level"],3)
        self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],73)
        self.assertEqual(d["devices"]["nest"]["after"]["heat_sp"],78)
        self.assertLess(datetime.fromisoformat(d["plan"]["warmup_start"]).hour,6)

    def test_warmup_never_before_three(self):
        d=decision(temp=50,t=timestamp("2026-11-23T02:30:00"))
        self.assertEqual(datetime.fromisoformat(d["plan"]["warmup_start"]).hour,3)
        self.assertEqual(d["period"],"night")

    def test_slow_model_starts_earlier(self):
        o,w=fixture(65);t=timestamp("2026-11-23T03:00:00")
        a=planner.decide(o,w,{}, {},{},DEFAULTS,t)
        b=planner.decide(o,w,{"rates":{"warmup_rate|both|20-30F":{"value":1,"n":10}}},{},{},DEFAULTS,t)
        self.assertLess(b["plan"]["warmup_start"],a["plan"]["warmup_start"])

    def test_warm_night_setback(self):
        d=decision(t=timestamp("2026-11-23T22:00:00"))
        self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],58)
        self.assertEqual(d["devices"]["nest"]["after"]["mode"],"OFF")
        self.assertEqual(d["devices"]["blower"]["after"],"auto")

    def test_cold_night_uses_sixty(self):
        o,w=fixture();w["forecast_low_f"]=10
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp("2026-11-23T22:00:00"))
        self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],60)

    def test_manual_raise_survives_until_period(self):
        s={};t=timestamp("2026-11-23T09:00:00");o,w=fixture(70)
        planner.decide(o,w,{},s,{},DEFAULTS,t)
        o["thermostats"]["honeywell"]["heat_sp"]=73
        d=planner.decide(o,w,{},s,{},DEFAULTS,t+60)
        self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],73)
        d=planner.decide(o,w,{},s,{},DEFAULTS,timestamp("2026-11-23T22:00:00"))
        self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],58)

    def test_missing_sensor_no_thermostat_changes(self):
        d=decision(temp=None)
        self.assertEqual(d["devices"]["nest"]["after"],{})
        self.assertFalse(d["devices"]["humidifier"]["after"])

    def test_stale_thermostat_not_raised(self):
        o,w=fixture();o["thermostats"]["nest"]["fresh"]=False
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp())
        self.assertEqual(d["devices"]["nest"]["after"],{})

    def test_fan_only_humidification_off(self):
        o,w=fixture()
        for x in o["thermostats"].values():x["calling"]=False
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp())
        self.assertFalse(d["devices"]["humidifier"]["after"])
        d=planner.decide(o,w,{}, {"stove_until":timestamp()+60},{},DEFAULTS,timestamp())
        self.assertTrue(d["devices"]["humidifier"]["after"])

    def test_humidifier_requires_upstairs_airflow(self):
        o,w=fixture();o["thermostats"]["honeywell"]["fan_running"]=False
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp())
        self.assertFalse(d["devices"]["humidifier"]["after"])

    def test_rh_cap_and_stale_runtime(self):
        o,w=fixture();o["sensors"]["living_rh"]=51
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp())
        self.assertFalse(d["devices"]["humidifier"]["after"])
        o["sensors"]["living_rh"]=o["sensors"]["loft_rh"]=None;s={}
        planner.decide(o,w,{},s,{},DEFAULTS,timestamp())
        d=planner.decide(o,w,{},s,{},DEFAULTS,timestamp()+601)
        self.assertFalse(d["devices"]["humidifier"]["after"])

    def test_away_and_override_expiry(self):
        s={};command(s,{"action":"away"},timestamp())
        d=decision(state=s);self.assertEqual(d["period"],"away")
        self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],50)
        s={};command(s,{"action":"warm","target_f":72,"hours":2},timestamp())
        self.assertEqual(decision(state=s,override=s["override"])["plan"]["target_f"],72)
        self.assertNotEqual(decision(state=s,override=s["override"],t=timestamp()+7201)["plan"]["target_f"],72)

    def test_temperature_safety(self):
        d=decision(temp=81)
        self.assertTrue(d["safety"]);self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],60)
        self.assertEqual(d["devices"]["nest"]["after"]["mode"],"OFF")

    def test_cooling_cannot_control_uncommissioned_equipment(self):
        d=decision(cfg=DEFAULTS|{"hvac_season":"cool"})
        self.assertEqual(d["devices"]["honeywell"]["after"],{})
        self.assertEqual(d["reason_code"],"COOLING_NOT_COMMISSIONED")

    def test_manual_auto_clears_hold(self):
        s={"manual_holds":{"honeywell":73},"period_id":"2026-11-23:day"}
        command(s,{"action":"auto"},timestamp())
        d=decision(70,t=timestamp("2026-11-23T12:00:00"),state=s)
        self.assertEqual(d["devices"]["honeywell"]["after"]["heat_sp"],70)

    def test_loft_uses_signed_difference(self):
        o,w=fixture(70);o["sensors"]["loft_f"]=65
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp())
        self.assertFalse(d["devices"]["loft_fan"]["after"])

    def test_model_only_learns_actual_heat(self):
        m={};o,w=fixture(65);start=timestamp()
        updates=[]
        for i in range(16):
            o["sensors"].update(living_f=65+i/30,living_f_ts=start+i*60,living_rh_ts=start+i*60)
            updates+=model.update(m,o,w,start+i*60)
        self.assertTrue(updates);self.assertIn("warmup_rate|both|20-30F",m["rates"])
        self.assertAlmostEqual(m["rates"]["warmup_rate|both|20-30F"]["value"],2)

    def test_model_gap_does_not_learn(self):
        m={};o,w=fixture();model.update(m,o,w,timestamp())
        o["sensors"].update(living_f=70,living_f_ts=timestamp()+1800)
        self.assertFalse(model.update(m,o,w,timestamp()+1800))

    def test_watchdog_dead_controller_and_cloud(self):
        o,w=fixture();o["thermostats"]["nest"]["age_s"]=1801
        a=watchdog.evaluate(o,{},timestamp())
        self.assertIn("PLANNER_STALE",a);self.assertIn("NEST_NO_READ_30M",a)

    def test_live_guard_blocks_without_manifest(self):
        with patch("controller.load",return_value={}):
            with self.assertRaises(RuntimeError):cutover_ready(DEFAULTS|{"mode":"live"})

    def test_outbox_survives_restart_and_exports_jsonl(self):
        with tempfile.TemporaryDirectory() as tmp:
            j=Journal(tmp);e=j.emit({"kind":"decision","mode":"shadow"},timestamp());j.db.close()
            j=Journal(tmp);self.assertEqual(j.pending(),1)
            text=next((Path(tmp)/"logs").glob("*.jsonl")).read_text()
            self.assertEqual(json.loads(text)["id"],e["id"])
            j.prune(timestamp()+3*366*86400);self.assertEqual(j.pending(),1);j.db.close()

    def test_upload_requires_exact_acknowledgement(self):
        with tempfile.TemporaryDirectory() as tmp:
            j=Journal(tmp);e=j.emit({"kind":"watchdog","mode":"shadow"},timestamp())
            cfg=DEFAULTS|{"upload_enabled":True}
            with patch("journal.Path.read_text",return_value="local-test-token"),patch("journal.urllib.request.urlopen",return_value=io.StringIO('{"ok":true}')):
                j.send(cfg)
            self.assertEqual(j.pending(),1)
            with patch("journal.Path.read_text",return_value="local-test-token"),patch("journal.urllib.request.urlopen",return_value=io.StringIO(json.dumps({"ok":True,"event_ids":[e["id"]]}))):
                j.send(cfg)
            self.assertEqual(j.pending(),0);j.db.close()

    def test_future_humidity_timestamp_does_not_refresh_temperature(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp);(home/"sensors").mkdir()
            (home/"sensors/latest.json").write_text(json.dumps({"couch":{"tC":20,"tC_ts":"2026-11-23T00:00:00-06:00","rh":40,"rh_ts":"2030-01-01T00:00:00Z"}}))
            obs=observations.read(timestamp(),DEFAULTS,home)
            self.assertIsNone(obs["sensors"]["living_f"]);self.assertIsNone(obs["sensors"]["living_rh"])

    def test_raw_day_target_not_reduced_by_sunshine(self):
        o,w=fixture(70);w.update(shortwave_wm2=500,cloud_pct=0)
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp("2026-11-23T12:00:00"))
        self.assertEqual(d["plan"]["target_f"],70)


class ActuatorTests(unittest.IsolatedAsyncioTestCase):
    async def test_nest_does_not_send_redundant_eco_command(self):
        from io_live import HouseIO
        b=HouseIO.__new__(HouseIO)
        b.nest_request=Mock(return_value={"traits":{"sdm.devices.traits.ThermostatMode":{"mode":"HEAT"},"sdm.devices.traits.ThermostatEco":{"mode":"OFF"}}})
        await b.write_device("nest",{"mode":"HEAT","heat_sp":78})
        self.assertEqual(b.nest_request.call_count,2)
        self.assertEqual(b.nest_request.call_args.args[0],"sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat")

    async def test_nest_heat_mode_precedes_eco_exit(self):
        from io_live import HouseIO
        b=HouseIO.__new__(HouseIO)
        b.nest_request=Mock(return_value={"traits":{"sdm.devices.traits.ThermostatMode":{"mode":"OFF"},"sdm.devices.traits.ThermostatEco":{"mode":"MANUAL_ECO"}}})
        await b.write_device("nest",{"mode":"HEAT","heat_sp":78})
        self.assertEqual([c.args[0] for c in b.nest_request.call_args_list[1:]],[
            "sdm.devices.commands.ThermostatMode.SetMode","sdm.devices.commands.ThermostatEco.SetMode","sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat"])

    async def test_live_tick_reads_freshness_after_poll(self):
        import controller
        o,w=fixture();seen=[];clock=[timestamp()]
        async def poll():clock[0]+=30
        def read(now,cfg):seen.append(now);return o
        b=Mock();b.poll=AsyncMock(side_effect=poll)
        with patch("controller.time.time",side_effect=lambda:clock[0]),patch("controller.observations.read",side_effect=read),patch("controller.weather.read",return_value=w),patch("controller.load",return_value={}):
            await controller.tick({},DEFAULTS,None,b,dry=True)
        self.assertEqual(seen,[timestamp()+30])

    async def test_humidifier_rechecks_airflow_and_fails_off(self):
        from io_live import HouseIO
        b=HouseIO.__new__(HouseIO);b.cfg={"shelly_url":"http://test"}
        b.hw=Mock();b.hw.device.refresh=AsyncMock();b.hw.device.fan_running=False
        b.h=Mock();b.h.shelly_rpc.return_value={"id":"verified-relay"}
        with patch("io_live.load",return_value={"humidifier_device_id":"verified-relay"}):
            with self.assertRaises(RuntimeError):await b.humidifier(True)
        b.h.shelly_on.assert_not_called();b.h.shelly_off.assert_called_once()

    async def test_humidifier_refresh_failure_fails_off(self):
        from io_live import HouseIO
        b=HouseIO.__new__(HouseIO);b.cfg={"shelly_url":"http://test"}
        b.hw=Mock();b.hw.device.refresh=AsyncMock(side_effect=TimeoutError())
        b.h=Mock();b.h.shelly_rpc.return_value={"id":"verified-relay"}
        with patch("io_live.load",return_value={"humidifier_device_id":"verified-relay"}):
            with self.assertRaises(TimeoutError):await b.humidifier(True)
        b.h.shelly_on.assert_not_called();b.h.shelly_off.assert_called_once()

    async def test_humidifier_live_verified_airflow_and_lease(self):
        from io_live import HouseIO
        b=HouseIO.__new__(HouseIO);b.cfg={"shelly_url":"http://test"}
        b.hw=Mock();b.hw.device.refresh=AsyncMock();b.hw.device.fan_running=True
        b.h=Mock();b.h.shelly_rpc.return_value={"id":"verified-relay"}
        b.h.shelly_status.return_value={"output":True,"timer_duration":600}
        with patch("io_live.load",return_value={"humidifier_device_id":"verified-relay"}):await b.humidifier(True)
        b.h.shelly_on.assert_called_once_with("http://test",600)

    async def test_watchdog_shadow_cannot_write(self):
        with patch("io_live.HouseIO") as backend:
            self.assertEqual(await watchdog.recover(DEFAULTS,["ROOM_TEMPERATURE_SAFETY"]),"shadow_no_writes")
            backend.assert_not_called()

    async def test_only_one_large_thermostat_change_per_tick(self):
        d=decision();d["id"]="test";d["devices"]["honeywell"]["before"]["heat_sp"]=58
        desired=d["devices"]["honeywell"]["after"]
        b=Mock();b.humidifier=AsyncMock();b.write_device=AsyncMock()
        b.read_device=AsyncMock(side_effect=[{"fresh":True,"heat_sp":58,"mode":"heat","fan":"auto"},{"fresh":True,**desired}])
        saved=Mock()
        await Actuator(b,AsyncMock(),saved).apply(d,{},DEFAULTS|{"mode":"live"},timestamp(),lambda e:None)
        self.assertEqual(d["devices"]["nest"]["write"],"deferred_large_change")
        self.assertEqual(b.write_device.await_count,1);saved.assert_called_once()
    async def test_shadow_never_calls_backend(self):
        backend=Mock();a=Actuator(backend)
        await a.apply(decision(),{},DEFAULTS,timestamp(),lambda x:None)
        self.assertEqual(backend.mock_calls,[])

    async def test_readback_timeout_then_observed_success_no_duplicate_send(self):
        d=decision();d["id"]="test";d["devices"]["nest"]["after"]={}
        desired=d["devices"]["honeywell"]["after"]
        b=Mock();b.read_device=AsyncMock(side_effect=[{"fresh":True,"heat_sp":68,"mode":"heat","fan":"auto"},{"fresh":True,**desired}])
        b.write_device=AsyncMock(side_effect=TimeoutError());b.humidifier=AsyncMock()
        await Actuator(b,AsyncMock()).apply(d,{},DEFAULTS|{"mode":"live"},timestamp(),lambda e:None)
        self.assertEqual(b.write_device.await_count,1)
        self.assertTrue(d["devices"]["honeywell"]["readback_ok"])

    async def test_hourly_cap_and_two_large_changes(self):
        d=decision();d["id"]="test"
        b=Mock();b.humidifier=AsyncMock()
        s={"actuator":{n:{"writes":[timestamp()-1200,timestamp()-1800,timestamp()-2400]} for n in ("honeywell","nest")}}
        await Actuator(b,AsyncMock()).apply(d,s,DEFAULTS|{"mode":"live"},timestamp(),lambda e:None)
        self.assertEqual(d["devices"]["honeywell"]["write"],"rate_limited")
        self.assertEqual(d["devices"]["nest"]["write"],"rate_limited")


class CutoverTests(unittest.TestCase):
    def gate(self):
        g={k:True for k in ("owner_go","cloud_control_jobs_paused","cloud_nest_refresh_stopped","comfort_settings_confirmed","airflow_interlocks_reviewed")}
        g.update(commissioning="passed",humidifier_device_id="relay",nest_device_name="nest",shadow_wait_waiver={"approved":True,"owner_instruction":"make it live", "recorded_at":"2026-11-23T14:00:00-06:00"})
        return g

    def test_explicit_owner_waiver_skips_only_wait(self):
        with patch("controller.load",return_value=self.gate()),patch("controller.subprocess.run",return_value=Mock(returncode=3)),patch("acceptance.check",return_value={"ready_for_owner_review":False}):
            cutover_ready(DEFAULTS|{"mode":"live"})

    def test_waiver_cannot_bypass_competing_writers(self):
        g=self.gate();g["cloud_control_jobs_paused"]=False
        with patch("controller.load",return_value=g):
            with self.assertRaises(RuntimeError):cutover_ready(DEFAULTS|{"mode":"live"})
        with patch("controller.load",return_value=self.gate()),patch("controller.subprocess.run",return_value=Mock(returncode=0)):
            with self.assertRaises(RuntimeError):cutover_ready(DEFAULTS|{"mode":"live"})

    def test_no_waiver_still_requires_observed_trial(self):
        g=self.gate();g.pop("shadow_wait_waiver")
        with patch("controller.load",return_value=g),patch("acceptance.check",return_value={"ready_for_owner_review":False}):
            with self.assertRaises(RuntimeError):cutover_ready(DEFAULTS|{"mode":"live"})

    def test_owner_waiver_cannot_bypass_hardware_checks(self):
        g=self.gate();g['commissioning']='pending'
        with patch('controller.load',return_value=g):
            with self.assertRaises(RuntimeError):cutover_ready(DEFAULTS|{'mode':'live'})

if __name__=="__main__":unittest.main()
