import copy
import unittest
from common import DEFAULTS
from reports import update
from test_heatctl import fixture,timestamp


class SavingsTests(unittest.TestCase):
    def event(self,period='day',prediction=71):
        return {'period':period,'plan':{'target_f':71,'wake_target_f':71,'predicted_wake_f':prediction}}

    def test_zone_costs_add_to_total_and_break_even(self):
        o,w=fixture();s={};now=timestamp('2026-11-27T05:00:00')
        o['thermostats']['honeywell']['calling']=True;o['thermostats']['nest']['calling']=True
        update(s,self.event('warmup'),o,DEFAULTS,now)
        d=update(s,self.event('warmup'),o,DEFAULTS,now+60);c=d['savings']['costs']
        self.assertAlmostEqual(c['upstairs_gas_usd_low']+c['nest_gas_usd'],d['gas_usd_low'])
        self.assertAlmostEqual(c['upstairs_gas_usd_high']+c['nest_gas_usd'],d['gas_usd_high'])
        self.assertEqual(c['basement_break_even_upstairs_min_low'],20)
        self.assertAlmostEqual(c['basement_break_even_upstairs_min_high'],28.57142857)
        self.assertFalse(c['savings_verified'])

    def test_forecast_frozen_and_comfort_shortfall_not_hidden_by_one_degree_deadband(self):
        o,w=fixture(70.5);s={};now=timestamp('2026-11-27T06:00:00')
        o['sensors']['living_f_ts']=now
        update(s,self.event('warmup',69),o,DEFAULTS,now)
        d=update(s,self.event('warmup',70.5),o,DEFAULTS,now+60)
        self.assertEqual(d['wake_prediction_f'],69)
        self.assertEqual(d['savings']['prediction_f'],69)
        now=timestamp('2026-11-27T07:00:00');o['sensors']['living_f_ts']=now
        d=update(s,self.event(),o,DEFAULTS,now)
        self.assertEqual(d['savings']['wake_shortfall_f'],.5)
        d=update(s,self.event(),o,DEFAULTS,now+60)
        self.assertEqual(d['savings']['below_target_min'],1)
        self.assertAlmostEqual(d['savings']['shortfall_degree_h'],.5/60)

    def test_gaps_and_unknown_calls_are_not_morning_runtime(self):
        o,w=fixture();s={};now=timestamp('2026-11-27T05:00:00')
        update(s,self.event('warmup'),o,DEFAULTS,now)
        d=update(s,self.event('warmup'),o,DEFAULTS,now+600)
        self.assertEqual(d['savings']['morning']['observed_h'],0)
        o['thermostats']['nest']['calling']=None
        update(s,self.event('warmup'),o,DEFAULTS,now+660)
        before=copy.deepcopy(d['savings']['morning'])
        d=update(s,self.event('warmup'),o,DEFAULTS,now+720)
        self.assertEqual(d['savings']['morning'],before)

    def test_stale_wake_sample_is_not_scored(self):
        o,w=fixture();now=timestamp('2026-11-27T07:00:00');o['sensors']['living_f_ts']=now-600
        d=update({},self.event(),o,DEFAULTS,now)
        self.assertNotIn('wake_actual_f',d['savings'])
