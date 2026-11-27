import copy
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock,Mock,patch
from common import DEFAULTS,TZ
import controller,fire_policy,ownership,planner
from test_heatctl import fixture


def at(text):return datetime.fromisoformat(text).replace(tzinfo=TZ).timestamp()


class CutoffTests(unittest.TestCase):
    def test_next_cutoff_clamps_evening_and_post_midnight_sessions(self):
        for text in ('2026-11-26T23:30:00','2026-11-27T00:45:00'):
            s={};controller.command(s,{'action':'stove','hours':8,'fan_hold':True},at(text))
            self.assertEqual(s['stove_until'],at('2026-11-27T01:00:00'))
            self.assertTrue(s['stove_fan_hold'])
        s={};controller.command(s,{'action':'stove','hours':1,'fan_hold':True},at('2026-11-26T20:00:00'))
        self.assertEqual(s['stove_until'],at('2026-11-26T21:00:00'))

    def test_chicago_dst_and_first_repeated_one_am(self):
        for text,target in [('2026-03-07T23:30:00','2026-03-08T01:00:00'),('2026-10-31T23:30:00','2026-11-01T01:00:00')]:
            self.assertEqual(fire_policy.next_cutoff(at(text)),at(target))
        repeated=datetime(2026,11,1,1,30,tzinfo=TZ,fold=1).timestamp()
        self.assertEqual(fire_policy.latest_cutoff(repeated),at('2026-11-01T01:00:00'))
        self.assertEqual(fire_policy.next_cutoff(repeated),at('2026-11-02T01:00:00'))

    def test_no_early_cutoff_then_catchup_and_repeat_is_idempotent(self):
        cutoff=at('2026-11-27T01:00:00')
        p={'enabled':True,'first_cutoff':cutoff}
        s={'stove_until':cutoff+7200,'stove_fan_hold':True,'control_holds':{'upstairs-fan':{'since':cutoff-100},'downstairs-temperature':{'since':cutoff-100}}}
        with patch('fire_policy.policy',return_value=p):
            self.assertFalse(fire_policy.prepare(s,cutoff-1));self.assertTrue(s['stove_fan_hold'])
            self.assertTrue(fire_policy.prepare(s,cutoff+300))
            self.assertFalse(s['stove_fan_hold']);self.assertEqual(s['stove_until'],cutoff)
            self.assertNotIn('upstairs-fan',s['control_holds'])
            self.assertIn('downstairs-temperature',s['control_holds'])
            s['fire_fan_auto_pending']=False
            self.assertFalse(fire_policy.prepare(s,cutoff+600))
            self.assertTrue(fire_policy.prepare(s,cutoff+86400))

    def test_only_two_owners_expire_and_humidity_follows_actual_blower(self):
        from humidity import decide
        cutoff=at('2026-11-27T01:00:00')
        with tempfile.TemporaryDirectory() as tmp,patch('ownership.ROOT',Path(tmp)),patch('fire_policy.policy',return_value={'enabled':True,'first_cutoff':cutoff}),patch('ownership.time.time',return_value=cutoff-3600):
            for scope in ownership.SCOPES:ownership.claim(scope)
            self.assertEqual(set(ownership.active(cutoff-1)),set(ownership.SCOPES))
            self.assertEqual(set(ownership.active(cutoff)),set(ownership.SCOPES)-{'upstairs-fan','humidifier'})
            self.assertEqual(ownership.active(cutoff-1)['upstairs-fan']['until'],cutoff)
        o,w=fixture(70);o['sensors']['living_rh']=30;o['blower']['observed_at']=cutoff
        self.assertTrue(decide(o,o['blower'],28,DEFAULTS,now=cutoff)['after'])
        o['blower']['running']=False
        self.assertFalse(decide(o,o['blower'],28,DEFAULTS,now=cutoff)['after'])

    def test_command_queued_before_one_cannot_extend_after_one(self):
        cutoff=at('2026-11-27T01:00:00');s={}
        controller.command(s,{'action':'stove','hours':8,'fan_hold':True},cutoff-30)
        with patch('fire_policy.policy',return_value={'enabled':True,'first_cutoff':cutoff}):
            fire_policy.prepare(s,cutoff+30)
        self.assertFalse(s['stove_fan_hold']);self.assertEqual(s['stove_until'],cutoff)


class CutoffActuationTests(unittest.IsolatedAsyncioTestCase):
    async def test_delayed_old_fan_on_cannot_reopen_after_cutoff(self):
        from io_live import HouseIO
        b=HouseIO.__new__(HouseIO);b.hw=Mock();b.hw.device.fan_mode='auto'
        b.hw.device.set_fan_mode=AsyncMock()
        b.fan_command_deadline=at('2026-11-27T01:00:00')
        with patch('ownership.active',return_value={}),patch('io_live.time.time',return_value=b.fan_command_deadline):
            with self.assertRaises(RuntimeError):await b.write_device('honeywell',{'fan':'on'})
        b.hw.device.set_fan_mode.assert_not_called()

    async def execute(self,before,readback=None,state=None,fail=False):
        now=at('2026-11-27T01:00:00');o,w=fixture(70)
        b=Mock();b.fast_humidity=True
        b.humidity_guard.latest={'observed_at':now,'observed':False,'after':False,'write':'ok','readback_ok':True}
        b.read_device=AsyncMock(side_effect=[before,before,readback or before]);b.write_device=AsyncMock()
        if fail:b.read_device=AsyncMock(side_effect=TimeoutError())
        s=state if state is not None else {};j=Mock()
        with patch('controller.time.time',return_value=now),patch('controller.observations.read',return_value=o),patch('controller.atomic'),patch('fire_policy.policy',return_value={'enabled':True,'first_cutoff':now}),patch('ownership.active',return_value={}),patch('actuator.asyncio.sleep',new=AsyncMock()):
            # Actuator's default sleep is bound at definition; replace construction
            # with the real class and a zero-delay sleep, retaining its checks.
            from actuator import Actuator
            with patch('actuator.Actuator',side_effect=lambda backend,persist:Actuator(backend,AsyncMock(),persist)):
                await controller.finish_fire_cutoff(s,DEFAULTS|{'mode':'live'},j,b)
        return s,b,j

    async def test_fan_only_command_and_verified_readback(self):
        s,b,j=await self.execute({'fresh':True,'fan':'on','heat_sp':58},{'fresh':True,'fan':'auto','heat_sp':58})
        b.write_device.assert_awaited_once_with('honeywell',{'fan':'auto'})
        b.poll.assert_not_called();b.humidifier.assert_not_called()
        self.assertFalse(s['fire_fan_auto_pending'])
        self.assertEqual(j.emit.call_args.args[0]['reason_code'],'FIRE_CUTOFF_VERIFIED')

    async def test_already_auto_needs_no_write(self):
        s,b,j=await self.execute({'fresh':True,'fan':'auto'})
        b.write_device.assert_not_called();self.assertFalse(s['fire_fan_auto_pending'])

    async def test_write_limits_are_preserved_and_report_pending(self):
        now=at('2026-11-27T01:00:00')
        s,b,j=await self.execute({'fresh':True,'fan':'on'},state={'actuator':{'honeywell':{'writes':[now-60]}}})
        b.write_device.assert_not_called();self.assertTrue(s['fire_fan_auto_pending'])
        self.assertEqual(j.emit.call_args.args[0]['safe_request']['write'],'rate_limited')

    async def test_unavailable_read_cannot_claim_verified(self):
        s,b,j=await self.execute({'fresh':False,'fan':'on'},fail=True)
        self.assertTrue(s['fire_fan_auto_pending']);b.write_device.assert_not_called()

    async def test_shadow_never_commands(self):
        b=Mock()
        await controller.finish_fire_cutoff({},DEFAULTS,Mock(),b)
        self.assertEqual(b.mock_calls,[])


if __name__=='__main__':unittest.main()
