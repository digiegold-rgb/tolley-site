import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parsePlannerEvents, heatCommandSchema } from "./planner-schema";

const event = () => ({ id: randomUUID(), ts: new Date().toISOString(), kind: "decision", mode: "shadow", season: "heat", inputs: { sensors: { living_f: 69 } }, plan: { target_f: 70 }, devices: {}, why: "Shadow proposal" });
test("planner preserves decision data and deduplicates UUIDs", () => {
  const e = event(); const result = parsePlannerEvents([e, e]);
  assert.equal(result.length, 1); assert.equal(result[0].plan?.target_f, 70);
});
test("planner rejects secret fields, incomplete learning, bad dates and oversized batches", () => {
  assert.throws(() => parsePlannerEvents([{ ...event(), inputs: { token: "forbidden" } }]));
  assert.throws(() => parsePlannerEvents([{ ...event(), kind: "learned" }]));
  assert.throws(() => parsePlannerEvents([{ ...event(), ts: "2035-01-01T00:00:00Z" }]));
  assert.throws(() => parsePlannerEvents(Array.from({ length: 101 }, event)));
});
test("cooling events fit the same schema", () => {
  assert.equal(parsePlannerEvents([{ ...event(), season: "cool" }])[0].season, "cool");
});
test("browser controls cannot enable live, override bounds or create unlimited holds", () => {
  for (const c of [{ action: "live" }, { action: "warm", target_f: 80 }, { action: "hold", hours: 999 }, { action: "stove", hours: 9 }, { action: "away", mode: "live" }]) {
    assert.equal(heatCommandSchema.safeParse(c).success, false);
  }
  assert.equal(heatCommandSchema.safeParse({ action: "warm", target_f: 71, hours: 2 }).success, true);
});
