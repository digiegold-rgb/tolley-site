import test from "node:test";
import assert from "node:assert/strict";
import {
  fromDgxEstimate,
  localEstimate,
  plannedMinutes,
  MOTION_USD_PER_MIN,
  STILLS_USD_PER_MIN,
} from "./estimate";

const DGX = { stillsUsd: 2, motionUsd: 10, ttsUsd: 1, minutes: 4, sceneCount: 60 };

test("unscaled DGX estimate is unchanged (default fraction = 1)", () => {
  const e = fromDgxEstimate(DGX, 0.35)!;
  assert.equal(e.breakdown.motion, 10);
  assert.equal(e.source, "dgx");
});

test("a hybrid window scales the DGX motion line", () => {
  const e = fromDgxEstimate(DGX, 0.35, 0.25)!;
  assert.equal(e.breakdown.motion, 2.5, "10 × 0.25");
  assert.ok(e.fullUsd < fromDgxEstimate(DGX, 0.35)!.fullUsd, "a shorter window must cost less");
});

test("fullUsd is recomputed from parts when motion was scaled", () => {
  // A payload whose own total contradicts a scaled breakdown must not win.
  const withTotal = { ...DGX, totalFullUsd: 13 };
  const unscaled = fromDgxEstimate(withTotal, 0, 1)!;
  assert.equal(unscaled.fullUsd, 13, "trust the DGX total when nothing was scaled");
  const scaled = fromDgxEstimate(withTotal, 0, 0.5)!;
  assert.equal(scaled.breakdown.motion, 5);
  assert.equal(scaled.fullUsd, 2 + 1 + 5, "recomputed, not the stale 13");
});

test("stills-only window costs the draft price", () => {
  const e = fromDgxEstimate(DGX, 0.35, 0)!;
  assert.equal(e.breakdown.motion, 0);
  assert.equal(e.fullUsd, e.draftUsd, "no motion means full == draft");
});

test("a nonsense fraction is clamped, never trusted", () => {
  for (const [f, expected] of [[-1, 0], [5, 10], [NaN, 10]] as const) {
    assert.equal(fromDgxEstimate(DGX, 0, f as number)!.breakdown.motion, expected);
  }
});

test("draftUsd is invariant under the window — it is the stills-only floor", () => {
  const a = localEstimate({ minutes: 6, opsRatePerMinute: 0.35, motionFraction: 1 });
  const b = localEstimate({ minutes: 6, opsRatePerMinute: 0.35, motionFraction: 0.1 });
  assert.equal(a.draftUsd, b.draftUsd, "this is WHY a draft number cannot track the slider");
  assert.ok(b.fullUsd < a.fullUsd, "but the full number must");
});

test("the rates behind the owner's $21", () => {
  // full = minutes × (stills + motion + ops). At 0.55 + 2.70 + 0.35 = $3.60/min,
  // $21 is ~5.8 minutes — a ~870-word script, not a 3,400-word one.
  const perMin = STILLS_USD_PER_MIN + MOTION_USD_PER_MIN + 0.35;
  assert.equal(Math.round(perMin * 100) / 100, 3.6);
  const e = localEstimate({ minutes: 21 / perMin, opsRatePerMinute: 0.35 });
  assert.ok(Math.abs(e.fullUsd - 21) < 0.05, `got ${e.fullUsd}`);
});

test("plannedMinutes ignores targetDuration once a script exists", () => {
  // Documents break #4: the length slider cannot move a price on this path.
  assert.equal(plannedMinutes({ scriptWords: 1450, targetDuration: 12 }), 10);
  assert.equal(plannedMinutes({ targetDuration: 12 }), 12, "…but it is used when there is no script");
});
