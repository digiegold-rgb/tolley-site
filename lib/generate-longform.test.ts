import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LONGFORM_RECIPE,
  LONGFORM_TARGET_DEFAULT,
  applyLastFrameToNext,
  applyLocalLongformBeatPatch,
  beatCountForDuration,
  canGenerateLongformBeat,
  canStitchLongform,
  estimateLongform,
  longformNeedsNewPlan,
  nextGeneratableLongformBeat,
  parseLongformQueue,
  parseScriptLines,
  planLongformQueue,
  promptsForPlan,
  rippleContinuityAfter,
} from "./generate-longform.ts";

const STILL = "https://blob.example/generate/lady2.png";
const FRAME = "/api/generate/jobs/child1/image?i=1";

describe("longform duration → beat count", () => {
  it("defaults 180s to 12 × 15s Wan 3.0 beats", () => {
    assert.equal(beatCountForDuration(180), 12);
    assert.equal(beatCountForDuration(LONGFORM_TARGET_DEFAULT), 12);
    assert.equal(beatCountForDuration(180, 5), 36);
    assert.equal(beatCountForDuration(180, 30), 6);
    assert.equal(beatCountForDuration(15), 1);
    assert.equal(beatCountForDuration(16), 2);
    assert.equal(beatCountForDuration(300, 15), 20);
    assert.equal(beatCountForDuration(9999), 20);
  });

  it("estimates fal calls before spend and stays honest about chained beats", () => {
    const e = estimateLongform({ targetSeconds: 180 });
    assert.equal(e.beat_count, 12);
    assert.equal(e.fal_calls, 12);
    assert.equal(e.beat_seconds, 15);
    assert.equal(e.planned_seconds, 180);
    assert.match(e.note, /Not one native/);
    assert.match(e.note, /last-frame/);
    assert.match(e.note, /\$/);
    const five = estimateLongform({ targetSeconds: 180, beatSeconds: 5 });
    assert.equal(five.beat_count, 36);
  });

  it("lets a longer script raise beat count above the duration floor", () => {
    const script = Array.from({ length: 40 }, (_, i) => `beat ${i + 1}`).join("\n");
    const e = estimateLongform({ targetSeconds: 180, script });
    assert.equal(e.beat_count, 40);
    assert.equal(e.fal_calls, 40);
  });
});

describe("longform scene plan", () => {
  it("plans N empty beats from duration and duplicates beat-1 prompt", () => {
    const q = planLongformQueue({
      targetSeconds: 45,
      sourceImageUrl: STILL,
      fallbackPrompt: "same adult woman, soft walk",
    });
    assert.equal(q.recipe, LONGFORM_RECIPE);
    assert.equal(q.continuity, "last_frame");
    assert.equal(q.beats.length, 3);
    assert.equal(q.beat_seconds, 15);
    assert.equal(q.beats[0].seconds, 15);
    assert.equal(q.beats[0].source_image_url, STILL);
    assert.equal(q.beats[1].source_image_url, "");
    assert.equal(q.beats[1].from_prev_last, true);
    assert.equal(q.beats[0].prompt, "same adult woman, soft walk");
    assert.equal(q.beats[2].prompt, "same adult woman, soft walk");
  });

  it("fills one prompt per non-empty script line and pads the rest", () => {
    assert.deepEqual(parseScriptLines("a\n\n# comment\nb\n"), ["a", "b"]);
    const prompts = promptsForPlan("turn\nwalk", 4, "hold");
    assert.deepEqual(prompts, ["turn", "walk", "walk", "walk"]);
    const q = planLongformQueue({
      targetSeconds: 45,
      sourceImageUrl: STILL,
      script: "she turns to camera\nshe walks to the stairs\nshe looks back",
    });
    assert.equal(q.beats.length, 3);
    assert.match(q.beats[1].prompt, /walks to the stairs/);
  });
});

describe("last-frame continuity", () => {
  it("chains the extracted last frame into the next beat source", () => {
    let q = planLongformQueue({ targetSeconds: 45, sourceImageUrl: STILL, fallbackPrompt: "walk" });
    q = { ...q, beats: q.beats.map((b, i) => (i === 0 ? { ...b, job_id: "child1", status: "ready" } : b)) };
    q = applyLastFrameToNext(q, 0, FRAME);
    assert.equal(q.beats[0].last_frame_url, FRAME);
    assert.equal(q.beats[1].source_image_url, FRAME);
    assert.equal(q.beats[1].from_prev_last, true);
    assert.equal(q.beats[2].source_image_url, "");
  });

  it("ripple resets later beats and re-chains only k+1", () => {
    let q = planLongformQueue({ targetSeconds: 45, sourceImageUrl: STILL, fallbackPrompt: "walk" });
    q = {
      ...q,
      beats: q.beats.map((b, i) => ({
        ...b,
        job_id: `j${i}`,
        status: i === 0 ? "ready" : "approved",
        last_frame_url: i === 0 ? "" : "/old.png",
      })),
    };
    q = rippleContinuityAfter(q, 0, FRAME);
    assert.equal(q.beats[1].source_image_url, FRAME);
    assert.equal(q.beats[1].status, "draft");
    assert.equal(q.beats[1].job_id, "");
    assert.equal(q.beats[2].status, "draft");
    assert.equal(q.beats[2].source_image_url, "");
    assert.equal(q.stitch_job_id, "");
  });

  it("without ripple, later approved clips stay put", () => {
    let q = planLongformQueue({ targetSeconds: 30, sourceImageUrl: STILL, fallbackPrompt: "walk" });
    q = {
      ...q,
      beats: q.beats.map((b, i) => ({
        ...b,
        job_id: `j${i}`,
        status: "approved" as const,
      })),
    };
    const next = applyLastFrameToNext(q, 0, FRAME);
    assert.equal(next.beats[1].source_image_url, FRAME);
    assert.equal(next.beats[1].status, "approved");
    assert.equal(next.beats[1].job_id, "j1");
  });

  it("blocks generate of beat 2 until beat 1 has a last frame", () => {
    const q = planLongformQueue({
      targetSeconds: 30,
      beatSeconds: 15,
      sourceImageUrl: STILL,
      fallbackPrompt: "walk",
    });
    const gate = canGenerateLongformBeat(q, q.beats[1].id);
    assert.equal(gate.ok, false);
    assert.match(gate.reason || "", /previous beat/i);
    assert.equal(canGenerateLongformBeat(q, q.beats[0].id).ok, true);
  });

  it("next generatable is beat 1, then stops until last-frame lands", () => {
    let q = planLongformQueue({ targetSeconds: 45, sourceImageUrl: STILL, fallbackPrompt: "walk" });
    assert.equal(nextGeneratableLongformBeat(q)?.id, q.beats[0].id);
    q = { ...q, beats: q.beats.map((b, i) => (i === 0 ? { ...b, status: "ready", job_id: "c1" } : b)) };
    assert.equal(nextGeneratableLongformBeat(q), null);
    q = applyLastFrameToNext(q, 0, FRAME);
    assert.equal(nextGeneratableLongformBeat(q)?.id, q.beats[1].id);
  });

  it("Go replans an empty or leftover-finished queue, not a mid-take", () => {
    const empty = parseLongformQueue({ source_image_url: STILL, beats: [] });
    assert.equal(longformNeedsNewPlan(empty), true);
    assert.equal(longformNeedsNewPlan({ ...empty, source_image_url: "" }), false);

    let planned = planLongformQueue({ targetSeconds: 30, sourceImageUrl: STILL, fallbackPrompt: "walk" });
    assert.equal(longformNeedsNewPlan(planned), false);

    const finished = {
      ...planned,
      beats: planned.beats.map((b, i) => ({ ...b, status: "approved" as const, job_id: `j${i}` })),
    };
    assert.equal(longformNeedsNewPlan(finished), true);

    const staleDrafts = {
      ...planned,
      source_image_url: STILL,
      beats: planned.beats.map((b, i) => ({
        ...b,
        status: "draft" as const,
        source_image_url: i === 0 ? "" : "",
      })),
    };
    assert.equal(longformNeedsNewPlan(staleDrafts), true);
  });
});

describe("longform stitch gate", () => {
  it("requires every beat approved", () => {
    let q = planLongformQueue({ targetSeconds: 30, sourceImageUrl: STILL, fallbackPrompt: "walk" });
    assert.equal(canStitchLongform(q).ok, false);
    q = {
      ...q,
      beats: q.beats.map((b, i) => ({ ...b, status: "approved" as const, job_id: `j${i}` })),
    };
    assert.equal(canStitchLongform(q).ok, true);
    const parsed = parseLongformQueue(q);
    assert.equal(parsed.recipe, LONGFORM_RECIPE);
    assert.equal(parsed.beats[0].source_image_url, STILL);
  });

  it("keeps spaces while typing a later beat prompt", () => {
    let q = planLongformQueue({ targetSeconds: 30, sourceImageUrl: STILL, fallbackPrompt: "walk" });
    q = applyLocalLongformBeatPatch(q, q.beats[1].id, { prompt: "she " });
    assert.equal(q.beats[1].prompt, "she ");
  });
});
