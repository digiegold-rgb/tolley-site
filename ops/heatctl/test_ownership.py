import asyncio
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock,Mock,patch
from common import DEFAULTS
from test_heatctl import fixture,timestamp
import ownership,planner,controller,telemetry
from io_live import HouseIO
from humidity import HumidityLoop
from actuator import Actuator

class OwnershipTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        p=patch('ownership.ROOT',Path(self.tmp.name));p.start();self.addCleanup(p.stop)

    def test_claim_release_and_expire_only_one_component(self):
        with patch('ownership.time.time',return_value=100):
            ownership.claim('upstairs-fan',2);ownership.claim('humidifier')
        self.assertEqual(set(ownership.active(101)),{'upstairs-fan','humidifier'})
        self.assertEqual(set(ownership.active(7300)),{'humidifier'})
        ownership.release('upstairs-fan')
        self.assertEqual(set(ownership.active(7301)),{'humidifier'})
        for h in (0,-1,25,float('nan')):
            with self.assertRaises(ValueError):ownership.claim('upstairs-fan',h)
        (Path(self.tmp.name)/'ownership.json').write_text('broken')
        self.assertEqual(set(ownership.active()),set(ownership.SCOPES))

    def test_manual_fan_keeps_thermostats_and_humidity_automatic(self):
        now=timestamp();o,w=fixture();s={'observed':copy.deepcopy(o['thermostats'])}
        o['thermostats']['honeywell']['fan']='on'
        d=planner.decide(o,w,{},s,{},DEFAULTS,now)
        self.assertNotIn('fan',d['devices']['honeywell']['after'])
        self.assertEqual(d['devices']['honeywell']['after']['heat_sp'],73)
        self.assertEqual(d['devices']['nest']['after']['heat_sp'],78)
        self.assertTrue(d['devices']['humidifier']['after'])
        self.assertEqual(set(d['plan']['manual_components']),{'upstairs-fan'})
        o['thermostats']['honeywell']['fan']='auto'
        d=planner.decide(o,w,{},s,{},DEFAULTS,now+60)
        self.assertIn('fan',d['devices']['honeywell']['after'])

    def test_lower_temperature_and_off_are_manual_too(self):
        for changed in ({'heat_sp':60},{'mode':'off'}):
            now=timestamp('2026-11-23T09:00:00');o,w=fixture(70);s={'observed':copy.deepcopy(o['thermostats'])}
            o['thermostats']['honeywell'].update(changed)
            d=planner.decide(o,w,{},s,{},DEFAULTS,now)
            self.assertNotIn('heat_sp',d['devices']['honeywell']['after'])
            self.assertNotIn('mode',d['devices']['honeywell']['after'])
            self.assertEqual(d['devices']['honeywell']['after']['fan'],'auto')
            d=planner.decide(o,w,{},s,{},DEFAULTS,timestamp('2026-11-23T22:00:00'))
            self.assertEqual(d['devices']['honeywell']['after']['heat_sp'],58)

    def test_own_writes_and_stale_readings_do_not_create_manual_holds(self):
        o,w=fixture();s={'observed':copy.deepcopy(o['thermostats']),'confirmed':{'honeywell':{'fan':'on'}}}
        o['thermostats']['honeywell']['fan']='on'
        d=planner.decide(o,w,{},s,{},DEFAULTS,timestamp())
        self.assertEqual(d['plan']['manual_components'],{})
        o['thermostats']['honeywell'].update(fresh=False,heat_sp=60)
        d=planner.decide(o,w,{},s,{},DEFAULTS,timestamp()+60)
        self.assertEqual(d['plan']['manual_components'],{})

    def test_explicit_owner_survives_safety_and_scoped_auto(self):
        o,w=fixture(81);s={'external_owners':{'upstairs-fan':{'owner':'Glow'}}}
        d=planner.decide(o,w,{},s,{},DEFAULTS,timestamp())
        self.assertNotIn('fan',d['devices']['honeywell']['after'])
        self.assertEqual(d['devices']['honeywell']['after']['heat_sp'],60)
        s={'control_holds':{'upstairs-fan':{},'downstairs-temperature':{}},'manual_holds':{'nest':72}}
        controller.command(s,{'action':'auto','component':'upstairs-fan'},timestamp())
        self.assertEqual(set(s['control_holds']),{'downstairs-temperature'})
        self.assertEqual(s['manual_holds'],{'nest':72})

class BoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_stale_planner_watchdog_preserves_manual_fan(self):
        now=timestamp();o,w=fixture(72);s={'observed':copy.deepcopy(o['thermostats'])}
        o['thermostats']['honeywell']['fan']='on'
        def loaded(path,default=None):
            return {'ts':now,'alerts':['PLANNER_STALE']} if path.name=='watchdog-request.json' else {}
        with patch('controller.time.time',return_value=now),patch('controller.observations.read',return_value=o),patch('controller.weather.read',return_value=w),patch('controller.load',side_effect=loaded),patch('ownership.active',return_value={}):
            d=await controller.tick(s,DEFAULTS|{'mode':'live'},None,dry=True)
        self.assertEqual(d['reason_code'],'WATCHDOG_SAFE_REQUEST')
        self.assertNotIn('fan',d['devices']['honeywell']['after'])
        self.assertEqual(d['devices']['honeywell']['after']['heat_sp'],60)

    async def test_read_only_adapter_blocks_every_write_entry(self):
        b=HouseIO.__new__(HouseIO);b.read_only=True
        with self.assertRaises(RuntimeError):await b.write_device('honeywell',{'fan':'auto'})
        with self.assertRaises(RuntimeError):await b.humidifier(False)
        with self.assertRaises(RuntimeError):b.nest_request('sdm.devices.commands.Fan.SetTimer',{'timerMode':'OFF'})
        with self.assertRaises(RuntimeError):await HumidityLoop(b).relay(False)

    async def test_nest_fan_only_does_not_exit_manual_eco(self):
        b=HouseIO.__new__(HouseIO)
        b.nest_request=Mock(return_value={'traits':{'sdm.devices.traits.ThermostatMode':{'mode':'HEAT'},'sdm.devices.traits.ThermostatEco':{'mode':'MANUAL_ECO'},'sdm.devices.traits.Fan':{}}})
        with patch('ownership.active',return_value={}):await b.write_device('nest',{'fan_timer':'OFF'})
        self.assertEqual([c.args[0] for c in b.nest_request.call_args_list[1:]],['sdm.devices.commands.Fan.SetTimer'])

    async def test_manual_claim_is_checked_at_send_boundary(self):
        b=HouseIO.__new__(HouseIO);b.hw=Mock()
        b.hw.device.system_mode='heat';b.hw.device.setpoint_heat=70;b.hw.device.fan_mode='on'
        b.hw.device.set_hold_heat=AsyncMock();b.hw.device.set_fan_mode=AsyncMock()
        with patch('ownership.active',return_value={'upstairs-fan':{}}):
            await b.write_device('honeywell',{'fan':'auto','heat_sp':71})
        b.hw.device.set_fan_mode.assert_not_called();b.hw.device.set_hold_heat.assert_awaited_once()

    async def test_new_manual_change_between_poll_and_write_is_preserved(self):
        o,w=fixture(70);d=planner.decide(o,w,{}, {},{},DEFAULTS,timestamp());d['id']='test'
        d['devices']['honeywell']['after']={'heat_sp':71,'fan':'auto'};d['devices']['nest']['after']={}
        b=Mock();b.humidifier=AsyncMock();b.write_device=AsyncMock()
        b.read_device=AsyncMock(side_effect=[{'fresh':True,'heat_sp':68,'fan':'on'},{'fresh':True,'heat_sp':71,'fan':'on'}])
        with patch('ownership.active',return_value={}):await Actuator(b,AsyncMock()).apply(d,{},DEFAULTS|{'mode':'live'},timestamp(),lambda e:None)
        self.assertEqual(b.write_device.call_args.args,('honeywell',{'heat_sp':71}))

    async def test_reporter_never_applies_proposals_or_consumes_commands(self):
        o,w=fixture(72);b=Mock();b.poll=AsyncMock();b.close=AsyncMock();b.last={};b.previous={};b.cfg={}
        with tempfile.TemporaryDirectory() as tmp,patch('telemetry.ROOT',Path(tmp)),patch('telemetry.HouseIO',return_value=b) as create,patch('telemetry.config',return_value=DEFAULTS),patch('telemetry.load',return_value={}),patch('telemetry.observations.read',return_value=o),patch('telemetry.weather.read',return_value=w),patch('telemetry.fcntl.flock'):
            row=await telemetry.collect()
        create.assert_called_once_with(read_only=True)
        self.assertEqual(row['mode'],'shadow');self.assertEqual(row['reason_code'],'REPORTING_ONLY')
        self.assertEqual(row['devices']['honeywell']['after'],{})
        self.assertEqual(row['inputs']['sensors']['living_f'],72)
        b.write_device.assert_not_called();b.humidifier.assert_not_called();b.publish.assert_not_called()

    async def test_reporter_defers_to_running_controller(self):
        import fcntl
        with tempfile.TemporaryDirectory() as tmp,patch('telemetry.ROOT',Path(tmp)),patch('telemetry.HouseIO') as create:
            with (Path(tmp)/'controller.lock').open('a') as lock:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
                self.assertIsNone(await telemetry.collect())
            create.assert_not_called()


class HumidityOwnershipTests(unittest.IsolatedAsyncioTestCase):
    async def test_manual_off_stays_off_without_stopping_other_controls(self):
        from test_blower import sample,obs,NOW,FastHumidityTests
        b=FastHumidityTests().backend();b.output=False
        sensor=Mock();sensor.sample.return_value=sample();loop=HumidityLoop(b,sensor)
        loop.latest={'observed_at':NOW-10,'observed':True,'readback_ok':True}
        with tempfile.TemporaryDirectory() as tmp,patch('ownership.ROOT',Path(tmp)),patch('humidity.time.time',return_value=NOW),patch('humidity.config',return_value=DEFAULTS|{'mode':'live'}),patch('humidity.read',return_value=obs()),patch('humidity.weather.read',return_value={'outdoor_f':28}),patch('humidity.atomic'):
            result=await loop.step()
            self.assertEqual(result['write'],'manual');self.assertFalse(result['observed'])
            self.assertEqual(set(ownership.active(NOW)),{'humidifier'})
        self.assertFalse(any(c.args[1]=='Switch.Set' for c in b.h.shelly_rpc.call_args_list))

    async def test_manual_ownership_does_not_bypass_airflow_safety(self):
        from test_blower import sample,obs,NOW,FastHumidityTests
        b=FastHumidityTests().backend();sensor=Mock();sensor.sample.return_value=sample(5,False)
        loop=HumidityLoop(b,sensor)
        with tempfile.TemporaryDirectory() as tmp,patch('ownership.ROOT',Path(tmp)),patch('humidity.time.time',return_value=NOW),patch('humidity.config',return_value=DEFAULTS|{'mode':'live'}),patch('humidity.read',return_value=obs()),patch('humidity.weather.read',return_value={'outdoor_f':28}),patch('humidity.atomic'),patch('humidity.load',return_value={'humidifier_device_id':'relay'}):
            ownership.claim('humidifier')
            result=await loop.step();self.assertFalse(result['observed'])
        writes=[c for c in b.h.shelly_rpc.call_args_list if c.args[1]=='Switch.Set']
        self.assertEqual([c.args[2] for c in writes],[{'id':0,'on':False}])

if __name__=='__main__':unittest.main()
