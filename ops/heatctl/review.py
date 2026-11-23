"""Local nightly report; shadow reports do not overwrite Glow's existing reviews."""
import json
import time
from datetime import datetime
from common import ROOT,TZ,config,load,atomic
from journal import Journal


def main():
    cfg=config();state=load(ROOT/"state.json",{}) or {};d=state.get("daily",{})
    date=datetime.now(TZ).date().isoformat()
    if d.get("date")!=date:raise SystemExit("No current-day observations")
    text=f'''# Crazy Monkey shadow comparison — {date}

Mode: {cfg['mode']}. Coverage: {d.get('coverage_h',0):.2f} hours since planner observation began.
Actual equipment behavior comes from the existing telemetry, not proposed commands.

- Upstairs heat: {d.get('upstairs_h',0):.2f} h; Nest heat: {d.get('nest_h',0):.2f} h.
- Estimated gas: ${d.get('gas_usd_low',0):.2f}–${d.get('gas_usd_high',0):.2f}; stage is unknown, gas is not metered.
- Blower-only: {d.get('blower_only_h',0):.2f} h; humidifiers: {d.get('humid_h',0):.2f} h.
- Estimated humidifier electricity: ${d.get('humid_usd',0):.2f}; water: {d.get('humid_water_gal',0):.1f} gal, water price {cfg['water_usd_per_gal']}.
- Wake temperature: {d.get('wake_actual_f')}F; shadow prediction: {d.get('wake_prediction_f')}F.
- Below target after wake: {d.get('below_target_min',0):.1f} min.
- Nest heating while living room below target: {d.get('nest_runtime_below_target_h',0):.2f} h.
- Stale/read-failed samples: {d.get('read_failures',0)}.

Predictions assume the proposed plan runs; current routines may behave differently.
Do not infer gas savings or successful morning comfort from shadow proposals.
'''
    dest=ROOT/"reviews";dest.mkdir(exist_ok=True)
    (dest/(date+".md")).write_text(text)
    Journal().emit({"kind":"review_model","mode":cfg["mode"],"season":cfg["hvac_season"],"date":date,"text":text})
    atomic(ROOT/"review-status.json",{"date":date,"generated_at":time.time(),"mode":cfg["mode"]})


if __name__=="__main__":main()
