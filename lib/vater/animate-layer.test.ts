import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCENE_SECONDS,
  formatSnap,
  snapWindowToRealScenes,
  snapWindowToScenes,
} from "./animate-layer";

test("Jared's worked example: 30s at 5s scenes = 6 scenes, exact", () => {
  const s = snapWindowToScenes(30, 5);
  assert.equal(s.sceneCount, 6);
  assert.equal(s.coverageEndS, 30);
  assert.equal(s.overshootS, 0);
  assert.equal(s.exact, true);
});

test("a request that would split a scene rounds UP to a whole one", () => {
  const s = snapWindowToScenes(32, 5);
  assert.equal(s.sceneCount, 7, "must not truncate to 6");
  assert.equal(s.coverageEndS, 35);
  assert.equal(s.overshootS, 3);
  assert.equal(s.exact, false);
});

test("never rounds down — one second past a boundary buys a whole scene", () => {
  const s = snapWindowToScenes(30.5, 5);
  assert.equal(s.sceneCount, 7);
  assert.ok(s.coverageEndS >= 30.5);
});

test("errs heavy at the default 4s pacing", () => {
  const s = snapWindowToScenes(30);
  assert.equal(DEFAULT_SCENE_SECONDS, 4);
  assert.equal(s.sceneCount, 8, "30/4 = 7.5 → 8");
  assert.equal(s.coverageEndS, 32);
});

test("coverage always reaches or passes what was asked for", () => {
  for (const pacing of [2.5, 4, 5, 6]) {
    for (let r = 1; r <= 180; r += 1) {
      const s = snapWindowToScenes(r, pacing);
      assert.ok(s.coverageEndS >= r, `${r}s @ ${pacing}s covered only ${s.coverageEndS}`);
      assert.ok(s.overshootS >= 0);
      assert.ok(s.overshootS < pacing, "never overshoots by a whole extra scene");
      assert.equal(s.sceneCount, Math.ceil(r / pacing));
    }
  }
});

test("zero and nonsense mean no motion, not one scene", () => {
  for (const bad of [0, -5, NaN, Infinity]) {
    const s = snapWindowToScenes(bad as number, 5);
    assert.equal(s.sceneCount, 0);
    assert.equal(s.coverageEndS, 0);
    assert.equal(s.exact, true);
  }
});

test("a broken pacing value falls back to the default rather than dividing by zero", () => {
  for (const bad of [0, -1, NaN]) {
    const s = snapWindowToScenes(30, bad as number);
    assert.equal(s.sceneCount, snapWindowToScenes(30, DEFAULT_SCENE_SECONDS).sceneCount);
  }
});

/* Real scenes are NOT evenly spaced — the planner fits cuts to sentences. */
const REAL = [
  { idx: 0, startS: 0, endS: 3.2 },
  { idx: 1, startS: 3.2, endS: 9.4 },
  { idx: 2, startS: 9.4, endS: 12.0 },
  { idx: 3, startS: 12.0, endS: 19.8 },
  { idx: 4, startS: 19.8, endS: 26.1 },
  { idx: 5, startS: 26.1, endS: 33.5 },
  { idx: 6, startS: 33.5, endS: 38.0 },
];

test("real boundaries: 30s pulls in the scene straddling the mark", () => {
  const s = snapWindowToRealScenes(30, REAL);
  assert.equal(s.sceneCount, 6, "scenes 0-5 all begin before 0:30");
  assert.equal(s.coverageEndS, 33.5, "the last one runs past the mark, whole");
  assert.equal(s.overshootS, 3.5);
  assert.equal(s.exact, false);
});

test("real boundaries: a request on an exact boundary does not over-buy", () => {
  const s = snapWindowToRealScenes(26.1, REAL);
  assert.equal(s.sceneCount, 5, "scene 5 starts AT 26.1, so it is not included");
  assert.equal(s.coverageEndS, 26.1);
  assert.equal(s.exact, true);
});

test("real boundaries: asking for less than one scene still buys that scene", () => {
  const s = snapWindowToRealScenes(1, REAL);
  assert.equal(s.sceneCount, 1);
  assert.equal(s.coverageEndS, 3.2);
});

test("real boundaries: untimed scenes fall back to uniform math, not to zero", () => {
  const s = snapWindowToRealScenes(30, [{ idx: 0 }, { idx: 1 }]);
  assert.equal(s.sceneCount, snapWindowToScenes(30).sceneCount);
});

test("real boundaries: zero means no motion", () => {
  assert.equal(snapWindowToRealScenes(0, REAL).sceneCount, 0);
});

test("formatSnap says what you get", () => {
  assert.match(formatSnap(snapWindowToScenes(30, 5)), /0:30 · 6 scenes/);
  assert.equal(formatSnap(snapWindowToScenes(0, 5)), "No motion — stills only");
  assert.match(formatSnap(snapWindowToScenes(4, 4)), /1 scene$/);
});
