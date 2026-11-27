import asyncio
import copy
import io
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch
from common import DEFAULTS
from blower import BlowerSensor, DEVICE_ID, SOURCE, MAX_AGE_S, airflow, get_reading
from blower_monitor import accumulate, calibration_update, classify
from humidity import HumidityLoop, decide, LEASE_S, POLL_S, HUMIDIFIER_URL

NOW=1795709000.0


def sample(watts=25.8,running=True):
    return {"device_id":DEVICE_ID,"source":SOURCE,"watts":watts,"running":running,"valid":True,
            "observed_at":NOW,"on_w":15,"off_w":10,"ts":"2026-11-26T10:03:20-06:00"}


def obs():
    return {"sensors":{"living_f":72,"living_rh":30,"loft_rh":28},
            "thermostats":{"honeywell":{"fresh":False,"calling":None,"fan_running":False}}}


class BlowerTests(unittest.TestCase):
    def test_honeywell_status_preserves_timestamp_and_never_reads_shelly(self):
        up={"fresh":True,"fan_running":True,"observed_at":NOW-30}
        sensor=BlowerSensor(lambda:up,lambda:NOW)
        with patch("urllib.request.urlopen") as network:
            row=sensor.sample()
            self.assertTrue(airflow(row,NOW));self.assertIsNone(row["watts"])
            self.assertEqual(row["observed_at"],NOW-30)
            network.assert_not_called()
        for change in ({"fresh":False},{"fan_running":None},{"fan_running":False},
                       {"observed_at":NOW-91},{"observed_at":NOW+1}):
            with self.subTest(change=change):
                self.assertFalse(airflow(BlowerSensor(lambda:up|change,lambda:NOW).sample(),NOW))
        sensor.read=Mock(side_effect=TimeoutError())
        self.assertFalse(sensor.sample()["valid"])

    def test_fireplace_and_old_power_rows_cannot_establish_airflow(self):
        for change in ({"device_id":"shellyplugusg4-98c37700c550"},
                       {"source":"furnace_power"},{"source":None}):
            self.assertFalse(airflow(sample()|change,NOW))

    def test_observations_ignore_old_fireplace_meter_cache(self):
        from observations import read
        from common import stamp
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp)
            (home/'heatctl').mkdir();(home/'humid').mkdir()
            (home/'heatctl/blower.json').write_text(json.dumps(sample()|{
                'device_id':'shellyplugusg4-98c37700c550','source':'furnace_power'}))
            hs={'honeywell_ok':True,'ts':stamp(NOW),'thermostats':{'honeywell':{
                't':NOW,'fan_running':False,'fan_mode':'on'}}}
            (home/'humid/state.json').write_text(json.dumps(hs))
            row=read(NOW,DEFAULTS,home)['blower']
            self.assertEqual(row['source'],SOURCE)
            self.assertFalse(row['running']);self.assertIsNone(row['watts'])
            hs['thermostats']['honeywell']['fan_running']=True
            (home/'humid/state.json').write_text(json.dumps(hs))
            self.assertTrue(airflow(read(NOW,DEFAULTS,home)['blower'],NOW))
            self.assertFalse(airflow(read(NOW+91,DEFAULTS,home)['blower'],NOW+91))

    def test_current_daily_report_discards_fireplace_totals(self):
        from reports import update
        from test_heatctl import fixture
        o,w=fixture();o['blower']=sample()
        state={'daily':{'date':'old','furnace_kwh':99,'blower_h':50}}
        event={'period':'day','plan':{'target_f':71}}
        daily=update(state,event,o,DEFAULTS,NOW)
        daily.update(furnace_kwh=99,blower_h=50,blower_watts=26,blower_observed_h=50)
        corrected=update(state,event,o,DEFAULTS,NOW+60)
        for key in ('furnace_kwh','blower_h','blower_watts','blower_observed_h'):
            self.assertNotIn(key,corrected)
        self.assertEqual(corrected['blower_source'],SOURCE)

    def test_humidity_any_cause_and_unknown_is_off(self):
        o=obs();cfg=DEFAULTS|{"mode":"live"}
        self.assertTrue(decide(o,sample(),28,cfg,now=NOW)["after"])
        for power in ({},sample(running=False),sample()|{"valid":False},sample()|{"observed_at":NOW-MAX_AGE_S-1},sample()|{"observed_at":NOW+1}):
            self.assertFalse(decide(o,power,28,cfg,now=NOW)["after"])
        for bad in ({"living_rh":51},{"living_rh":None,"loft_rh":None},{"living_f":None},{"living_f":81},{"living_f":54}):
            o=obs();o["sensors"].update(bad)
            self.assertFalse(decide(o,sample(),28,cfg,now=NOW)["after"])
        self.assertFalse(decide(obs(),sample(),28,cfg|{"hvac_season":"cool"},now=NOW)["after"])

    def test_runtime_gaps_unknown_and_midnight(self):
        a=sample();d=accumulate({},a,{})
        b=sample()|{"observed_at":NOW+10};d=accumulate(a,b,d)
        self.assertAlmostEqual(d["blower_h"],10/3600)
        d=accumulate(b,b|{"observed_at":NOW+100},d)
        self.assertAlmostEqual(d["blower_h"],10/3600)
        d=accumulate(b,b|{"observed_at":NOW+20,"valid":False},d)
        self.assertAlmostEqual(d["blower_h"],10/3600)
        from datetime import datetime
        from common import TZ
        midnight=datetime(2026,11,27,tzinfo=TZ).timestamp()
        d=accumulate(sample()|{"observed_at":midnight-5},sample()|{"observed_at":midnight+5},d)
        self.assertEqual(d["date"],"2026-11-27");self.assertAlmostEqual(d["blower_h"],5/3600)

    def test_calibration_does_not_invent_heat_state(self):
        self.assertEqual(classify(sample(),obs()),"unclassified")
        self.assertEqual(classify(sample(5,False),obs()),"idle_candidate")
        o=obs();o["thermostats"]["honeywell"].update(fresh=True,calling=True)
        self.assertEqual(classify(sample(),o),"heat_call")
        summary={}
        for w in (20,30):calibration_update(summary,sample(w)|{"calibration_state":"fan_only"})
        self.assertEqual(summary["fan_only"]["mean_w"],25)


class FastHumidityTests(unittest.IsolatedAsyncioTestCase):
    def backend(self):
        b=Mock();b.cfg={"shelly_url":HUMIDIFIER_URL}
        def rpc(url,method,params=None,timeout=None):
            if method=="Shelly.GetDeviceInfo":return {"id":"relay"}
            if method=="Switch.Set":b.output=params["on"];return {}
            return {"output":b.output,"timer_duration":LEASE_S}
        b.h.shelly_rpc=Mock(side_effect=rpc);b.output=False
        return b

    async def test_power_only_on_then_stop_off_and_no_cloud_reads(self):
        b=self.backend();sensor=Mock();sensor.sample.return_value=sample()
        loop=HumidityLoop(b,sensor)
        def load(path,default=None):return {"humidifier_device_id":"relay"} if path.name=="cutover.json" else {}
        with patch("humidity.time.time",return_value=NOW),patch("humidity.config",return_value=DEFAULTS|{"mode":"live"}),patch("humidity.read",return_value=obs()),patch("humidity.weather.read",return_value={"outdoor_f":28}),patch("humidity.load",side_effect=load),patch("humidity.atomic"):
            on=await loop.step();self.assertTrue(on["observed"])
            sensor.sample.return_value=sample(5,False)
            off=await loop.step();self.assertFalse(off["observed"])
        writes=[c for c in b.h.shelly_rpc.call_args_list if c.args[1]=="Switch.Set"]
        self.assertEqual(writes[0].args[2],{"id":0,"on":True,"toggle_after":30})
        self.assertEqual(writes[-1].args[2],{"id":0,"on":False})
        self.assertTrue(all(c.args[0]==HUMIDIFIER_URL for c in writes))
        b.hw.device.refresh.assert_not_called()
        self.assertLessEqual(POLL_S+6+3+9,30);self.assertEqual(LEASE_S,30)

    async def test_furnace_can_never_be_a_relay_target(self):
        b=self.backend();b.cfg["shelly_url"]="http://192.168.2.151"
        with self.assertRaises(RuntimeError):await HumidityLoop(b).relay(False)
        b.h.shelly_rpc.assert_not_called()

    async def test_wrong_relay_identity_cannot_write(self):
        b=self.backend();b.h.shelly_rpc.return_value={"id":"wrong"};b.h.shelly_rpc.side_effect=None
        with patch("humidity.load",return_value={"humidifier_device_id":"relay"}):
            with self.assertRaises(RuntimeError):await HumidityLoop(b).relay(True)
        self.assertEqual(b.h.shelly_rpc.call_count,1)

    async def test_missing_lease_forces_off(self):
        b=self.backend()
        b.h.shelly_rpc=Mock(side_effect=[{"id":"relay"},{},{"output":True,"timer_duration":600},{}])
        with patch("humidity.load",return_value={"humidifier_device_id":"relay"}):
            with self.assertRaises(RuntimeError):await HumidityLoop(b).relay(True)
        self.assertEqual(b.h.shelly_rpc.call_args.args[2],{"id":0,"on":False})

    async def test_slow_cloud_work_does_not_block_fast_task(self):
        loop=HumidityLoop(self.backend());stop=asyncio.Event();ran=asyncio.Event()
        async def step():ran.set();stop.set()
        loop.step=AsyncMock(side_effect=step)
        cloud=asyncio.create_task(asyncio.sleep(60))
        await asyncio.wait_for(loop.run(stop),1)
        self.assertTrue(ran.is_set());self.assertFalse(cloud.done())
        cloud.cancel()
        with self.assertRaises(asyncio.CancelledError):await cloud
