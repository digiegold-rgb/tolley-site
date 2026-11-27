import asyncio
import copy
import json
import tempfile
import io
import unittest
from datetime import datetime,timedelta
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
        "humidifier":False,"loft_fan":False,"loft_watts":0,
        "blower":{"device_id":"honeywell","source":"honeywell_fan_status","valid":True,"running":True,"watts":25.8,"observed_at":timestamp()}}
    w={"outdoor_f":28,"feels_f":20,"wind_mph":10,"gust_mph":15,"cloud_pct":60,
       "precip_mm":0,"shortwave_wm2":0,"forecast_low_f":25,"fresh":True,"hours":[]}
    return obs,w


def decision(temp=62.1,t=None,state=None,override=None,cfg=None):
    o,w=fixture(temp)
    o["blower"]["observed_at"]=t or timestamp()
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
        self.assertEqual(d["devices"]["honeywell"]["before"]["heat_sp"],73)
        self.assertNotIn("heat_sp",d["devices"]["honeywell"]["after"])
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

    def test_fan_only_humidification_allowed_from_power(self):
        o,w=fixture()
        for x in o["thermostats"].values():x.update(calling=False,fan_running=False,fresh=False)
        d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp())
        self.assertTrue(d["devices"]["humidifier"]["after"])

    def test_humidifier_requires_furnace_power_even_when_cloud_says_running(self):
        o,w=fixture();o["blower"].update(running=False,watts=5)
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
    async def test_honeywell_hold_accepted_at_every_minute_and_midnight(self):
        from io_live import HouseIO
        from aiosomecomfort.device import _hold_quarter_hours
        b=HouseIO.__new__(HouseIO);b.hw=Mock()
        d=b.hw.device;d.system_mode="heat";d.setpoint_heat=66;d.fan_mode="auto"
        d.set_hold_heat=AsyncMock()
        for hour in (7,22,23):
            for minute in range(60):
                now=datetime(2026,11,24,hour,minute,37,tzinfo=TZ)
                with patch("io_live.datetime") as clock:
                    clock.now.return_value=now
                    await b.write_device("honeywell",{"heat_sp":73,"mode":"heat","fan":"auto"})
                until=d.set_hold_heat.call_args.args[0]
                _hold_quarter_hours(until)  # Real installed client's validation.
                self.assertEqual(until.second,0)
                expires=datetime.combine(now.date(),until,tzinfo=TZ)
                if expires<=now:expires+=timedelta(days=1)
                self.assertGreaterEqual(expires-now,timedelta(hours=2))
                self.assertLess(expires-now,timedelta(hours=2,minutes=15))
                self.assertEqual(d.set_hold_heat.call_args.kwargs["temperature"],73)

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


class FireDayTests(unittest.IsolatedAsyncioTestCase):
    def plan(self,state,now=None,running=False,rh=30,temp=72):
        now=now or timestamp("2026-11-26T12:00:00")
        obs,w=fixture(temp)
        for t in obs["thermostats"].values():t.update(calling=False,fan_running=running)
        obs["sensors"]["living_rh"]=rh
        obs["blower"].update(running=running,observed_at=now,watts=25.8 if running else 5)
        return planner.decide(obs,w,{},state,{},DEFAULTS,now)

    def test_stove_fan_hold_and_expiry_keep_airflow_interlock(self):
        now=timestamp("2026-11-26T12:00:00");state={}
        command(state,{"action":"stove","hours":2,"fan_hold":True},now)
        d=self.plan(state,now)
        self.assertEqual(d["devices"]["honeywell"]["after"]["fan"],"on")
        self.assertEqual(d["devices"]["blower"]["after"],"on")
        self.assertFalse(d["devices"]["humidifier"]["after"])
        self.assertTrue(self.plan(state,now+60,running=True)["devices"]["humidifier"]["after"])
        self.assertFalse(self.plan(state,now+120,running=True,rh=55)["devices"]["humidifier"]["after"])
        d=self.plan(state,now+7200,running=True)
        self.assertEqual(d["devices"]["honeywell"]["after"]["fan"],"auto")
        self.assertTrue(d["devices"]["humidifier"]["after"])  # Still powered after stove expiry.

    def test_stove_default_cancel_away_safety(self):
        now=timestamp("2026-11-26T12:00:00");state={}
        command(state,{"action":"stove"},now)
        self.assertEqual(self.plan(state,now)["devices"]["blower"]["after"],"auto")
        for other,temp in (({"housemode":"away"},72),({},81)):
            s={"stove_until":now+3600,"stove_fan_hold":True,**other}
            d=self.plan(s,now,running=True,temp=temp)
            self.assertEqual(d["devices"]["blower"]["after"],"auto")
            self.assertEqual(d["devices"]["humidifier"]["after"],temp<80)
        command(state,{"action":"stove","hours":0,"fan_hold":True},now)
        self.assertFalse(state["stove_fan_hold"])
        for cmd in ({"action":"stove","hours":9},{"action":"stove","fan_hold":"yes"},
                    {"action":"nest-fan","hours":13},{"action":"nest-fan","hours":float("nan")},
                    {"action":"nest-fan","fan":"AUTO"}):
            with self.assertRaises(ValueError):command({},cmd,now)

    def test_nest_fan_deadline_and_no_upstairs_airflow(self):
        now=timestamp("2026-11-26T12:00:00");s={}
        command(s,{"action":"nest-fan","hours":2},now)
        d=self.plan(s,now)
        self.assertEqual(d["devices"]["nest"]["after"]["fan_timer"],"ON")
        self.assertEqual(d["devices"]["nest"]["after"]["fan_until"],now+7200)
        self.assertFalse(d["devices"]["humidifier"]["after"])
        self.assertEqual(self.plan(s,now+7200)["devices"]["nest"]["after"]["fan_timer"],"OFF")
        command(s,{"action":"nest-fan","fan":"OFF"},now)
        self.assertEqual(s["nest_fan_until"],0)

    async def test_watchdog_overrides_both_fan_requests(self):
        import controller
        now=timestamp("2026-11-26T12:00:00");obs,w=fixture(72)
        s={"stove_until":now+7200,"stove_fan_hold":True,"nest_fan_until":now+7200}
        def loaded(path,default=None):
            return {"ts":now,"alerts":["PLANNER_STALE"]} if path.name=="watchdog-request.json" else {}
        with patch("controller.time.time",return_value=now),patch("controller.observations.read",return_value=obs),patch("controller.weather.read",return_value=w),patch("controller.load",side_effect=loaded):
            d=await controller.tick(s,DEFAULTS|{"mode":"live"},None,dry=True)
        self.assertEqual(d["reason_code"],"WATCHDOG_SAFE_REQUEST")
        self.assertEqual(d["devices"]["honeywell"]["after"]["fan"],"auto")
        self.assertEqual(d["devices"]["blower"]["after"],"auto")
        self.assertEqual(d["devices"]["nest"]["after"]["fan_timer"],"OFF")
        self.assertNotIn("fan_until",d["devices"]["nest"]["after"])
        self.assertFalse(d["devices"]["humidifier"]["after"])

    async def test_nest_timer_payload_and_readback(self):
        from io_live import HouseIO
        from actuator import changed
        b=HouseIO.__new__(HouseIO);now=timestamp()
        traits={"sdm.devices.traits.ThermostatMode":{"mode":"HEAT"},
                "sdm.devices.traits.Fan":{"timerMode":"ON","timerTimeout":datetime.fromtimestamp(now+7200,TZ).isoformat()}}
        b.nest_request=Mock(return_value={"traits":traits})
        desired={"fan_timer":"ON","fan_until":now+7200}
        with patch("io_live.time.time",return_value=now):await b.write_device("nest",desired)
        b.nest_request.assert_called_with("sdm.devices.commands.Fan.SetTimer",{"timerMode":"ON","duration":"7200s"})
        self.assertFalse(changed(await b.read_device("nest"),desired))
        self.assertTrue(changed({"fan_timer":"ON","fan_until":now+600},desired))
        await b.write_device("nest",{"fan_timer":"OFF"})
        b.nest_request.assert_called_with("sdm.devices.commands.Fan.SetTimer",{"timerMode":"OFF"})
        traits.pop("sdm.devices.traits.Fan");b.nest_request.reset_mock()
        with self.assertRaises(RuntimeError):await b.write_device("nest",desired)
        self.assertEqual(b.nest_request.call_count,1)

    async def test_two_failed_sends_alert_persists_then_clears(self):
        d=decision();d["id"]="test";d["devices"]["nest"]["after"]={}
        old=d["devices"]["honeywell"]["before"]
        b=Mock();b.read_device=AsyncMock(return_value=old)
        b.write_device=AsyncMock(side_effect=TimeoutError());b.humidifier=AsyncMock()
        s={};events=[]
        await Actuator(b,AsyncMock()).apply(d,s,DEFAULTS|{"mode":"live"},timestamp(),events.append)
        self.assertEqual(s["actuator"]["honeywell"]["failed_writes"],3)
        self.assertIn("HONEYWELL_WRITE_FAILURE_2",d["alerts"])
        self.assertEqual(len([e for e in events if e["kind"]=="watchdog"]),1)
        self.assertEqual(len(s["actuator"]["honeywell"]["writes"]),3)
        d=decision();d["id"]="next";d["devices"]["nest"]["after"]={}
        await Actuator(b,AsyncMock()).apply(d,s,DEFAULTS|{"mode":"live"},timestamp()+60,events.append)
        self.assertEqual(d["devices"]["honeywell"]["write"],"rate_limited")
        self.assertIn("HONEYWELL_WRITE_FAILURE_2",d["alerts"])
        d=decision();d["id"]="recovered";d["devices"]["nest"]["after"]={}
        b.read_device=AsyncMock(return_value={"fresh":True,**d["devices"]["honeywell"]["after"]})
        await Actuator(b,AsyncMock()).apply(d,s,DEFAULTS|{"mode":"live"},timestamp()+3601,events.append)
        self.assertEqual(s["actuator"]["honeywell"]["failed_writes"],0)
        self.assertNotIn("HONEYWELL_WRITE_FAILURE_2",d["alerts"])

    async def test_fresh_poll_clears_failed_send_alert_without_resend(self):
        d=decision();d["id"]="verified";d["devices"]["nest"]["after"]={}
        d["devices"]["honeywell"]["before"].update(d["devices"]["honeywell"]["after"])
        s={"actuator":{"honeywell":{"writes":[timestamp()],"failed_writes":2}},"honeywell_failure_since":timestamp()-1800}
        b=Mock();b.humidifier=AsyncMock()
        await Actuator(b,AsyncMock()).apply(d,s,DEFAULTS|{"mode":"live"},timestamp(),lambda e:None)
        self.assertEqual(s["actuator"]["honeywell"]["failed_writes"],0)
        self.assertNotIn("HONEYWELL_WRITE_FAILURE_2",d["alerts"])
        self.assertNotIn("honeywell_failure_since",s)
        b.write_device.assert_not_called()

    async def test_read_errors_without_send_do_not_count_as_failed_writes(self):
        d=decision();d["id"]="test";d["devices"]["nest"]["after"]={}
        b=Mock();b.read_device=AsyncMock(side_effect=TimeoutError());b.humidifier=AsyncMock()
        s={}
        await Actuator(b,AsyncMock()).apply(d,s,DEFAULTS|{"mode":"live"},timestamp(),lambda e:None)
        self.assertEqual(s["actuator"]["honeywell"].get("failed_writes",0),0)
        b.write_device.assert_not_called()


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
