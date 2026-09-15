import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imageCost, motionCost, modalCost, cinemaClipCost, usd } from "./generate-cost.ts";
import { cardToFalT2IInput, cardToFalT2VInput, parseGenerateEngineCard } from "./generate-engine-card.ts";
import { falT2IModelId, falT2VModelId } from "./generate-engine.ts";
import { defaultMotionCard } from "./generate-motion-card.ts";
import { spawnInputForCard, falModelIdFromCard } from "./generate-motion.ts";
import { beatFromMotionCard, motionCardFromBeat, parseBeatQueue, emptyBeatQueue } from "./generate-beats.ts";
import { emptyLongformQueue, emptyLongformBeat, remainingLongformSpend } from "./generate-longform.ts";
import { emptyCinemaQueue, emptyCinemaBeat, estimateCinema } from "./generate-cinema.ts";

describe("internal generation quotes and model routing", () => {
  it("prices each image by rounded-up megapixels with sub-cent precision", () => {
    for (const aspect of ["9:16", "16:9", "1:1"] as const) {
      assert.equal(imageCost("flux-dev", aspect), 0.05);
      assert.equal(imageCost("flux-schnell", aspect), 0.006);
    }
    assert.equal(usd(0.006), "$0.006");
  });
  it("changes image submission and polling together, retaining old-job defaults", () => {
    const card = parseGenerateEngineCard({ prompt: "A ceramic vase", model: "flux-schnell" });
    const planned = cardToFalT2IInput(card);
    assert.equal(planned.falModelId, "flux-schnell");
    assert.deepEqual(planned.input.image_size, { width: 768, height: 1344 });
    assert.equal(planned.input.prompt, "A ceramic vase");
    assert.equal(falT2IModelId({ fal_model: planned.falModelId }), "flux-schnell");
    assert.equal(falT2IModelId({}), "flux-dev");
    assert.throws(() => parseGenerateEngineCard({ prompt: "A vase", model: "wan30-t2v" }), /incompatible/);
    assert.throws(() => parseGenerateEngineCard({ prompt: "A vase", model: "unconfigured" }));
  });
  it("prices the exact rounded Wan 3 duration submitted, not legacy frame counts", () => {
    const p = cardToFalT2VInput(parseGenerateEngineCard({ prompt: "A vase rotates", model: "wan30-t2v", seconds: 2.5 }, "t2v"));
    assert.equal(p.falModelId, "wan30-t2v");
    assert.equal(p.input.duration, 3);
    assert.equal(p.input.num_frames, undefined);
    assert.equal(motionCost("wan30-t2v", 2.5), 0.3);
    assert.equal(motionCost("wan26-720p", 2), 0.4);
    assert.equal(motionCost("wan26-720p", 5), 0.4);
    assert.equal(falT2VModelId({ fal_model: p.falModelId }), "wan30-t2v");
    assert.equal(falT2VModelId({}), "wan26-720p");
  });
  it("preserves a beat's selected model across save and routes the right inputs and poller", () => {
    const card = defaultMotionCard({ source_image_url: "https://example.com/a.png", end_image_url: "https://example.com/b.png", model: "wan30-i2v", seconds: 5 });
    const saved = parseBeatQueue(emptyBeatQueue({ beats: [beatFromMotionCard(card)] }));
    const restored = motionCardFromBeat(saved.beats[0]);
    const p = spawnInputForCard(restored);
    assert.equal(p.falModelId, "wan30-i2v");
    assert.equal(p.input.start_image_url, card.source_image_url);
    assert.equal(p.input.end_image_url, card.end_image_url);
    assert.equal(falModelIdFromCard({ fal_model: p.falModelId }, p.recipe), "wan30-i2v");
    assert.equal(spawnInputForCard({ ...restored, model: "wan-legacy" }).falModelId, "wan-flf2v");
  });
  it("prices longform using each remaining scene's resolution and excludes completed scenes", () => {
    const q = emptyLongformQueue({ beats: [emptyLongformBeat({ seconds: 10, resolution: "1080p" }), emptyLongformBeat({ seconds: 5, resolution: "720p" }), emptyLongformBeat({ seconds: 30, status: "approved" })] });
    assert.equal(remainingLongformSpend(q).usd, 2.5);
  });
  it("prices Kling audio per shot and includes Seedance reference-video exposure", () => {
    const q = emptyCinemaQueue({ model: "kling", beats: [emptyCinemaBeat({ seconds: 10, generate_audio: false }, "kling"), emptyCinemaBeat({ seconds: 10, generate_audio: true }, "kling")] });
    assert.equal(estimateCinema(q).usd, 2.8);
    assert.equal(estimateCinema(q).usd_high, undefined);
    const noRef = cinemaClipCost({ model: "seedance", seconds: 10 });
    const withRef = cinemaClipCost({ model: "seedance", seconds: 10, videoInput: true });
    assert(withRef.low < noRef.low);
    assert(withRef.high! > noRef.low);
    assert(cinemaClipCost({ model: "seedance", seconds: 10, resolution: "1080p" }).low > noRef.low);
  });
  it("scales the explicit Modal runtime assumption by minutes and image count", () => {
    assert.equal(modalCost(5, 4), modalCost(5, 1) * 4);
    assert.equal(modalCost(10, 1), modalCost(5, 1) * 2);
    assert(modalCost(5, 1) > 0.25 && modalCost(5, 1) < 0.26);
  });
});
