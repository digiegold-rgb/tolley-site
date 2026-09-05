import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cardToFalInput,
  falModelIdFromCardHint,
  falPublicStatus,
  isFalConfigured,
  parseGenerateMotionCard,
} from "./generate-motion-card.ts";

const STILL = "https://blob.example/generate/lady2.png";

describe("isFalConfigured + public status", () => {
  it("requires FAL_KEY and never invents Seedance / LatentSync", () => {
    assert.equal(isFalConfigured({}), false);
    assert.equal(isFalConfigured({ FAL_KEY: "fal-x" }), true);
    const status = falPublicStatus({});
    assert.equal(status.configured, false);
    assert.equal(status.provider, "fal.ai");
    assert.equal(status.i2v, "fal-ai/wan-i2v");
    assert.equal(status.flf2v, "fal-ai/wan-flf2v");
    assert.equal(status.faceLock, "not-wired");
    assert.equal(status.stitch, "concat-approved-beats");
    assert.equal(status.slowMo, "0.5x-remux");
    assert.equal(status.skeletonVideo, "not-supported");
  });
});

describe("card → fal input", () => {
  it("forwards the source still as image_url and no credentials", () => {
    const card = parseGenerateMotionCard({
      prompt: "same face, slight smile",
      source_image_url: STILL,
    });
    const planned = cardToFalInput(card);
    assert.equal(planned.input.image_url, STILL);
    assert.equal(planned.recipe, "fal-wan-i2v");
    assert.doesNotMatch(JSON.stringify(planned), /FAL_KEY|ak-|as-/);
  });
});

describe("falModelIdFromCardHint", () => {
  it("reads fal_model or end_image_url", () => {
    assert.equal(falModelIdFromCardHint({ fal_model: "wan-flf2v" }, "fal-wan-i2v"), "wan-flf2v");
    assert.equal(falModelIdFromCardHint({ end_image_url: STILL }, "fal-wan-i2v"), "wan-flf2v");
    assert.equal(falModelIdFromCardHint({}, "fal-wan-i2v"), "wan26-i2v-720p");
  });
});
