import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEATS_RECIPE,
  addBeat,
  approvedBeatJobIds,
  beatFromMotionCard,
  canGenerateBeat,
  canStitchBeats,
  emptyBeat,
  emptyBeatQueue,
  markBeatFromChildJob,
  markBeatGenerating,
  motionCardFromBeat,
  moveBeat,
  parseBeatQueue,
  patchBeat,
  removeBeat,
  setBeatStatus,
  sourceStillFromPrevious,
  stitchBlockers,
} from "./generate-beats.ts";
import { parseGenerateMotionCard } from "./generate-motion-card.ts";

const STILL = "https://blob.example/generate/lady2.png";

describe("beat queue helpers", () => {
  it("adds, reorders, and removes beats without auto-stitch", () => {
    let q = emptyBeatQueue();
    assert.equal(q.recipe, BEATS_RECIPE);
    q = addBeat(q, { prompt: "walks to the stairs", source_image_url: STILL });
    q = addBeat(q, { prompt: "turns to camera", source_image_url: STILL });
    assert.equal(q.beats.length, 2);
    const first = q.beats[0].id;
    q = moveBeat(q, first, 1);
    assert.equal(q.beats[1].id, first);
    q = removeBeat(q, first);
    assert.equal(q.beats.length, 1);
    assert.equal(q.stitch_job_id, "");
  });

  it("blocks stitch until every beat is approved", () => {
    let q = emptyBeatQueue();
    q = addBeat(q, { prompt: "a", source_image_url: STILL, status: "ready", job_id: "j1" });
    q = addBeat(q, { prompt: "b", source_image_url: STILL, status: "draft" });
    assert.equal(canStitchBeats(q).ok, false);
    assert.match(stitchBlockers(q)[0] || "", /not approved/);
    q = setBeatStatus(q, q.beats[0].id, "approved");
    q = patchBeat(q, q.beats[1].id, { status: "approved", job_id: "j2" });
    assert.equal(canStitchBeats(q).ok, true);
    assert.deepEqual(approvedBeatJobIds(q), ["j1", "j2"]);
  });

  it("round-trips a beat through the motion card (including slow_mo)", () => {
    const card = parseGenerateMotionCard({
      prompt: "soft smile, hair moves",
      source_image_url: STILL,
      slow_mo: true,
    });
    const beat = beatFromMotionCard(card);
    assert.equal(beat.slow_mo, true);
    assert.equal(canGenerateBeat(beat).ok, true);
    const back = motionCardFromBeat(beat);
    assert.equal(back.slow_mo, true);
    assert.equal(back.source_image_url, STILL);
  });

  it("marks generating → ready from the child job and uses previous still", () => {
    let q = emptyBeatQueue();
    q = addBeat(q, { prompt: "one", source_image_url: STILL, end_image_url: STILL });
    q = addBeat(q, { prompt: "two", from_prev_last: true });
    assert.equal(sourceStillFromPrevious(q, 1), STILL);
    q = markBeatGenerating(q, q.beats[0].id, "child1");
    assert.equal(q.beats[0].status, "generating");
    q = markBeatFromChildJob(q, "child1", { status: "done" });
    assert.equal(q.beats[0].status, "ready");
    q = markBeatFromChildJob(q, "child1", { status: "failed", error: "boom" });
    assert.equal(q.beats[0].status, "rejected");
    const parsed = parseBeatQueue(q);
    assert.equal(parsed.beats[0].job_id, "child1");
    assert.equal(emptyBeat().status, "draft");
  });
});
