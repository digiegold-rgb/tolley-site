import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ANIMATE_LAYER_DEFAULT_QUALITY,
  ANIMATE_LAYER_WINDOW_S,
  animateLayerLimitCopy,
  formatAnimateLayerCoverage,
  planAnimateLayer,
  quoteAnimateLayer,
  resolveAnimateLayerQuality,
} from "./animate-layer";

describe("planAnimateLayer", () => {
  it("selects scenes that begin inside the opening window", () => {
    const plan = planAnimateLayer([
      { idx: 0, startS: 0, endS: 8 },
      { idx: 1, startS: 8, endS: 16 },
      { idx: 2, startS: 16, endS: 28 },
      { idx: 3, startS: 28, endS: 40 },
      { idx: 4, startS: 40, endS: 52 },
    ]);
    assert.deepEqual(plan.sceneIdxs, [0, 1, 2, 3]);
    assert.equal(plan.windowS, ANIMATE_LAYER_WINDOW_S);
    assert.equal(plan.fallback, "timings");
    assert.equal(plan.coverageStartS, 0);
    assert.equal(plan.coverageEndS, 40);
    assert.equal(plan.timed, true);
  });

  it("excludes scenes that start at or after the window", () => {
    const plan = planAnimateLayer(
      [
        { idx: 0, startS: 0, endS: 30 },
        { idx: 1, startS: 30, endS: 45 },
      ],
      { windowS: 30 },
    );
    assert.deepEqual(plan.sceneIdxs, [0]);
  });

  it("skips scenes that already have a clip unless forced", () => {
    const scenes = [
      { idx: 0, startS: 0, endS: 10, videoUrl: "https://cdn/a.mp4" },
      { idx: 1, startS: 10, endS: 20 },
      { idx: 2, startS: 20, endS: 35 },
    ];
    const fresh = planAnimateLayer(scenes);
    assert.deepEqual(fresh.sceneIdxs, [1, 2]);
    assert.deepEqual(fresh.skippedAnimatedIdxs, [0]);

    const forced = planAnimateLayer(scenes, { includeAnimated: true });
    assert.deepEqual(forced.sceneIdxs, [0, 1, 2]);
    assert.deepEqual(forced.skippedAnimatedIdxs, []);
  });

  it("falls back to equal-share when timings are missing", () => {
    const plan = planAnimateLayer(
      [{ idx: 0 }, { idx: 1 }, { idx: 2 }, { idx: 3 }],
      { audioDuration: 80 },
    );
    assert.equal(plan.fallback, "equal-share");
    // 80s / 4 = 20s each → scenes 0 and 1 begin before 30s.
    assert.deepEqual(plan.sceneIdxs, [0, 1]);
    assert.equal(plan.coverageEndS, 40);
  });

  it("falls back to the first scene when there is no clock", () => {
    const plan = planAnimateLayer([{ idx: 7 }, { idx: 8 }]);
    assert.equal(plan.fallback, "first-scene");
    assert.deepEqual(plan.sceneIdxs, [7]);
    assert.equal(plan.timed, false);
  });

  it("uses array index when idx is missing", () => {
    const plan = planAnimateLayer([
      { startS: 0, endS: 12 },
      { startS: 12, endS: 24 },
    ]);
    assert.deepEqual(plan.sceneIdxs, [0, 1]);
  });

  it("returns an empty plan when every opening scene is already animated", () => {
    const plan = planAnimateLayer([
      { idx: 0, startS: 0, endS: 20, videoUrl: "/a.mp4" },
      { idx: 1, startS: 40, endS: 50 },
    ]);
    assert.deepEqual(plan.sceneIdxs, []);
    assert.deepEqual(plan.skippedAnimatedIdxs, [0]);
  });
});

describe("quoteAnimateLayer", () => {
  it("prices per clip at the published Wan narrative rate", () => {
    const plan = planAnimateLayer([
      { idx: 0, startS: 0, endS: 10 },
      { idx: 1, startS: 10, endS: 20 },
    ]);
    const quote = quoteAnimateLayer(plan, ANIMATE_LAYER_DEFAULT_QUALITY);
    assert.equal(quote.priceCentsPerClip, 150);
    assert.equal(quote.estimateCents, 300);
    assert.match(quote.qualityLabel, /Wan2\.2 Narrative/);
  });
});

describe("copy helpers", () => {
  it("never claims a sliced 30s file", () => {
    const plan = planAnimateLayer([
      { idx: 0, startS: 0, endS: 12 },
      { idx: 1, startS: 12, endS: 36 },
    ]);
    const copy = animateLayerLimitCopy(plan);
    assert.match(copy, /whole scenes/i);
    assert.doesNotMatch(copy, /sliced 30s file is what you get/i);
    assert.match(formatAnimateLayerCoverage(plan), /0:00–0:36 · 2 clips/);
  });

  it("falls unknown qualities back to the narrative default", () => {
    assert.equal(resolveAnimateLayerQuality("nope"), ANIMATE_LAYER_DEFAULT_QUALITY);
    assert.equal(resolveAnimateLayerQuality("modal-wan22-fast"), "modal-wan22-fast");
  });
});
