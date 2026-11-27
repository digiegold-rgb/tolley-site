import test from "node:test";
import assert from "node:assert/strict";
import { gasFromRuntime, furnaceBlowerStatus, FIREPLACE_DEVICE_ID } from "./accounting";
import { buildHeatView } from "./view";
import type { HeatDay } from "./types";

test("separate furnace runtimes preserve gas cost when the zone mix changes", () => {
  const upstairs=gasFromRuntime(1,0), basement=gasFromRuntime(0,1), both=gasFromRuntime(1,1);
  assert.ok(upstairs.low>basement.high*2);
  assert.equal(basement.low,basement.high);
  assert.ok(Math.abs(both.low-upstairs.low-basement.low)<1e-9);
  assert.ok(Math.abs(both.high-upstairs.high-basement.high)<1e-9);
  assert.deepEqual(gasFromRuntime(0,0),{low:0,high:0});
});

test("fireplace power cannot appear as fresh furnace airflow", () => {
  const now=Date.now();const row={device_id:"honeywell",source:"honeywell_fan_status",valid:true,running:true,observed_at:now/1000};
  assert.equal(furnaceBlowerStatus(row,now),"Running");
  assert.equal(furnaceBlowerStatus({...row,running:false},now),"Stopped");
  for(const change of [{device_id:FIREPLACE_DEVICE_ID},{source:"furnace_power"},{valid:false},{observed_at:now/1000-91},{observed_at:now/1000+1}]) {
    assert.equal(furnaceBlowerStatus({...row,...change},now),"Unknown");
  }
});

test("CCF/HDD is weighted and excludes the current partial day", () => {
  const day=(date:string,hdd65:number,ccfPerHdd:number):HeatDay=>({date,hdd65,ccfPerHdd,
    upstairsHeatH:1,downstairsHeatH:0,upstairsCycles:1,downstairsCycles:0,
    outdoorLow:null,outdoorHigh:null,outdoorAvg:null,estThermsLow:1,estThermsHigh:1,estCostLow:1,estCostHigh:1});
  const view=buildHeatView({latest:null,snapshots:[],review:null,days:[
    day("2026-11-25",10,.1),day("2026-11-26",30,.2),day("2026-11-27",100,9),
  ]},new Date("2026-11-27T15:00:00Z"));
  assert.equal(view.ccf.recentAvg,.175);assert.equal(view.ccf.days,2);
});
