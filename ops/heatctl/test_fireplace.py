import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import fireplace
from test_fire_cutoff import at


class FireplaceTests(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        self.cutoff=at('2026-11-28T01:00:00')
        self.policy={'enabled':True,'first_cutoff':self.cutoff-86400,
                     'first_fireplace_cutoff':self.cutoff}
        for p in (patch('fireplace.ROOT',self.root),
                  patch('fire_policy.policy',return_value=self.policy)):
            p.start();self.addCleanup(p.stop)

    def finish(self, now=None, mode='live'):
        return fireplace.finish({'mode':mode},self.cutoff if now is None else now)

    def test_exact_off_payload_and_verified_once_per_cutoff(self):
        with patch('fireplace.rpc',side_effect=[{'id':fireplace.DEVICE_ID},{},{'output':False}]) as rpc:
            self.assertTrue(self.finish()['verified'])
            self.assertEqual(rpc.call_args_list[1].args,('Switch.Set',{'id':0,'on':False}))
            self.assertTrue(self.finish(self.cutoff+120)['verified'])
            self.assertEqual(rpc.call_count,3)
        status=json.loads((self.root/'fireplace-cutoff-status.json').read_text())
        self.assertTrue(status['verified'])

    def test_no_early_shadow_or_disabled_write(self):
        with patch('fireplace.rpc') as rpc:
            self.assertIsNone(self.finish(self.cutoff-1))
            self.assertIsNone(self.finish(mode='shadow'))
            self.policy['enabled']=False
            self.assertIsNone(self.finish())
            rpc.assert_not_called()

    def test_wrong_identity_never_writes(self):
        with patch('fireplace.rpc',return_value={'id':'wrong'}) as rpc:
            self.assertFalse(self.finish()['verified'])
            self.assertEqual(rpc.call_count,1)

    def test_failed_off_retries_after_one_minute_and_catches_up(self):
        with patch('fireplace.rpc',side_effect=TimeoutError('unreachable')) as rpc:
            self.assertFalse(self.finish(self.cutoff+300)['verified'])
            self.finish(self.cutoff+310)
            self.assertEqual(rpc.call_count,1)
        with patch('fireplace.rpc',side_effect=[{'id':fireplace.DEVICE_ID},{},{'output':False}]):
            self.assertTrue(self.finish(self.cutoff+360)['verified'])

    def test_readback_on_is_pending(self):
        with patch('fireplace.rpc',side_effect=[{'id':fireplace.DEVICE_ID},{},{'output':True}]):
            self.assertFalse(self.finish()['verified'])

    def test_rpc_only_allows_pinned_off_and_no_toggle_after(self):
        with patch('fireplace.urllib.request.urlopen',return_value=io.StringIO('{}')) as fetch:
            fireplace.rpc('Switch.Set',{'id':0,'on':False})
            request=fetch.call_args.args[0]
            self.assertEqual(request.full_url,'http://192.168.2.151/rpc/Switch.Set')
            self.assertEqual(json.loads(request.data),{'id':0,'on':False})
            self.assertEqual(request.get_method(),'POST')
            for method,params in [('Switch.Set',{'id':0,'on':True}),('Switch.Toggle',{'id':0}),
                                  ('Switch.Set',{'id':1,'on':False}),('Sys.SetConfig',{})]:
                with self.assertRaises(ValueError):fireplace.rpc(method,params)
            self.assertEqual(fetch.call_count,1)

    def test_controller_checks_fireplace_even_after_honeywell_auto_verified(self):
        import asyncio,controller
        journal=Mock()
        with patch('fireplace.rpc',side_effect=[{'id':fireplace.DEVICE_ID},{},{'output':False}]), \
             patch('controller.time.time',return_value=self.cutoff):
            state={'fire_cutoff_at':self.cutoff,'fire_fan_auto_pending':False}
            asyncio.run(controller.finish_fire_cutoff(state,{'mode':'live'},journal,Mock()))
        self.assertTrue(json.loads((self.root/'fireplace-cutoff-status.json').read_text())['verified'])
