import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENGINE_RECIPE_T2I,
  ENGINE_RECIPE_T2V,
  FLUX_IMAGE_SIZE,
  cardToFalT2IInput,
  cardToFalT2VInput,
  falEnginePublicStatus,
  isEngineRecipe,
  isFalImageRecipe,
  isFalVideoRecipe,
  parseGenerateEngineCard,
  wanFramesForSeconds,
} from "./generate-engine-card.ts";
import { MOTION_RECIPE_I2V } from "./generate-motion-card.ts";
import { formatFalError, formatFalFailure } from "./fal.ts";

describe("parseGenerateEngineCard", () => {
  it("defaults T2I to 9:16 FLUX and T2V to Wan 5s", () => {
    const t2i = parseGenerateEngineCard({ prompt: "photoreal Lady2, lace, 85mm" }, "t2i");
    assert.equal(t2i.recipe, ENGINE_RECIPE_T2I);
    assert.equal(t2i.aspect, "9:16");
    const t2v = parseGenerateEngineCard({ prompt: "she turns toward camera", seconds: 4, slow_mo: true }, "t2v");
    assert.equal(t2v.recipe, ENGINE_RECIPE_T2V);
    assert.equal(t2v.seconds, 4);
    assert.equal(t2v.slow_mo, true);
    assert.throws(() => parseGenerateEngineCard({ prompt: "" }, "t2i"));
  });
});

describe("card → fal input", () => {
  it("emits flux/dev with safety checker off and portrait_16_9", () => {
    const card = parseGenerateEngineCard(
      { prompt: "photoreal adult woman, lace, 85mm", aspect: "9:16", seed: 7 },
      "t2i",
    );
    const planned = cardToFalT2IInput(card);
    assert.equal(planned.falModelId, "flux-dev");
    assert.equal(planned.input.enable_safety_checker, false);
    assert.equal(planned.input.image_size, FLUX_IMAGE_SIZE["9:16"]);
    assert.equal(planned.input.seed, 7);
    assert.doesNotMatch(JSON.stringify(planned), /FAL_KEY|Gemini|quickgen/i);
  });

  it("emits wan-t2v with 4n+1 frames and no Gemini keyframe", () => {
    const card = parseGenerateEngineCard(
      { prompt: "hair in the wind, soft smile", aspect: "9:16", seconds: 5 },
      "t2v",
    );
    const planned = cardToFalT2VInput(card);
    assert.equal(planned.falModelId, "wan26-720p");
    assert.equal(planned.input.num_frames, 81);
    assert.equal(planned.input.enable_safety_checker, false);
    assert.equal(planned.input.aspect_ratio, "9:16");
    assert.equal(Object.hasOwn(planned.input, "image_url"), false);
    assert.doesNotMatch(JSON.stringify(planned), /gemini|scene_frames|lady-wan22/i);
  });
});

describe("wanFramesForSeconds", () => {
  it("maps 2–5s onto Wan 4n+1 frame counts", () => {
    assert.equal(wanFramesForSeconds(2), 33);
    assert.equal(wanFramesForSeconds(3), 49);
    assert.equal(wanFramesForSeconds(4), 65);
    assert.equal(wanFramesForSeconds(5), 81);
  });
});

describe("recipe helpers + public status", () => {
  it("does not treat Qwen stills as fal engines and marks V2V unwired", () => {
    assert.equal(isFalImageRecipe(ENGINE_RECIPE_T2I), true);
    assert.equal(isFalVideoRecipe(ENGINE_RECIPE_T2V), true);
    assert.equal(isFalVideoRecipe(MOTION_RECIPE_I2V), true);
    assert.equal(isEngineRecipe("qwen-image-edit-2511"), false);
    const status = falEnginePublicStatus({});
    assert.equal(status.configured, false);
    assert.equal(status.t2i, "fal-ai/flux/dev");
    assert.equal(status.t2v, "fal-ai/wan-t2v");
    assert.equal(status.v2v, "not-wired");
  });
});

describe("formatFalError", () => {
  it("includes HTTP status and body detail", () => {
    const err = Object.assign(new Error("image generation failed"), {
      status: 422,
      body: { detail: "finish_reason=SAFETY prompt_blocked" },
    });
    const text = formatFalError(err);
    assert.match(text, /HTTP 422/);
    assert.match(text, /finish_reason=SAFETY/);
    assert.equal(formatFalFailure({ status: "FAILED", error: "queue rejected", logs: ["step 1"] }), "FAILED — queue rejected — step 1");
  });
});
