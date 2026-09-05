import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MOTION_PROMPT,
  MOTION_CARD_SYSTEM_PROMPT,
  MOTION_NUM_FRAMES,
  MOTION_RECIPE_FLF2V,
  MOTION_RECIPE_I2V,
  cardToFalInput,
  emptyMotionCard,
  formatMotionCardJson,
  isMotionRecipe,
  mergeMotionCard,
  parseGenerateMotionCard,
  parseLlmMotionCard,
  parseMotionCardJson,
} from "./generate-motion-card.ts";

const STILL = "https://blob.example/generate/lady2.png";
const POSE = "https://blob.example/generate/pose.png";

describe("parseGenerateMotionCard", () => {
  it("requires an HTTPS source still and defaults to Wan I2V", () => {
    const card = parseGenerateMotionCard({
      prompt: "she turns toward camera, same face",
      source_image_url: STILL,
    });
    assert.equal(card.recipe, MOTION_RECIPE_I2V);
    assert.equal(card.seconds, 5);
    assert.equal(card.aspect, "9:16");
    assert.equal(card.slow_mo, false);
    assert.throws(() => parseGenerateMotionCard({ prompt: "x" }));
    assert.throws(() =>
      parseGenerateMotionCard({ prompt: "x", source_image_url: "http://insecure.example/a.png" }),
    );
    const gated = parseGenerateMotionCard({
      prompt: "same face from gallery",
      source_image_url: "/api/generate/jobs/clxyz/image?i=0",
    });
    assert.equal(gated.source_image_url, "/api/generate/jobs/clxyz/image?i=0");
  });

  it("promotes to FLF2V only when a last-frame still is set", () => {
    const card = parseGenerateMotionCard({
      prompt: "walks to the end pose, same face",
      source_image_url: STILL,
      end_image_url: POSE,
    });
    assert.equal(card.recipe, MOTION_RECIPE_FLF2V);
    assert.equal(card.end_image_url, POSE);
    const none = parseGenerateMotionCard({
      prompt: "x",
      source_image_url: STILL,
      end_image_url: "  ",
    });
    assert.equal(none.recipe, MOTION_RECIPE_I2V);
    assert.equal(none.end_image_url, "");
  });
});

describe("cardToFalInput", () => {
  it("emits wan-i2v image_url kwargs with safety checker off", () => {
    const card = parseGenerateMotionCard({
      prompt: DEFAULT_MOTION_PROMPT,
      source_image_url: STILL,
      seed: 12,
    });
    const planned = cardToFalInput(card);
    assert.equal(planned.falModelId, "wan26-i2v-720p");
    assert.equal(planned.input.image_url, STILL);
    assert.equal(planned.input.start_image_url, undefined);
    assert.equal(planned.input.enable_safety_checker, false);
    assert.equal(planned.input.num_frames, MOTION_NUM_FRAMES);
    assert.doesNotMatch(JSON.stringify(planned), /FAL_KEY|Seedance|latentsync/i);
  });

  it("emits wan-flf2v start/end stills — not a skeleton video", () => {
    const card = parseGenerateMotionCard({
      prompt: "holds the last pose",
      source_image_url: STILL,
      end_image_url: POSE,
    });
    const planned = cardToFalInput(card);
    assert.equal(planned.falModelId, "wan-flf2v");
    assert.equal(planned.input.start_image_url, STILL);
    assert.equal(planned.input.end_image_url, POSE);
    assert.equal(Object.hasOwn(planned.input, "image_url"), false);
    assert.equal(Object.hasOwn(planned.input, "pose_video_url"), false);
    assert.equal(Object.hasOwn(planned.input, "skeleton_url"), false);
  });
});

describe("merge + LLM parse + JSON", () => {
  it("leaves empty source on the form card and round-trips JSON", () => {
    const base = emptyMotionCard();
    const merged = mergeMotionCard(base, { prompt: "she waves, same face", seed: 7 });
    assert.equal(merged.source_image_url, "");
    assert.match(merged.prompt, /waves/);
    assert.equal(merged.seed, 7);
    const full = parseGenerateMotionCard({ ...merged, source_image_url: STILL });
    const back = parseMotionCardJson(formatMotionCardJson(full));
    assert.deepEqual(back, full);
  });

  it("does not wipe an existing source still when the LLM sends empty source_image_url", () => {
    const base = parseGenerateMotionCard({ prompt: "she turns", source_image_url: STILL });
    const merged = mergeMotionCard(base, {
      prompt: "she waves, same face",
      source_image_url: "",
      end_image_url: "",
    });
    assert.equal(merged.source_image_url, STILL);
    assert.match(merged.prompt, /waves/);
    const fromLlm = parseLlmMotionCard(
      '{"reply":"Kept the still.","prompt":"slight smile","source_image_url":""}',
      base,
    );
    assert.equal(fromLlm.card.source_image_url, STILL);
  });

  it("parses fenced LLM JSON", () => {
    const parsed = parseLlmMotionCard(
      '```json\n{"reply":"Ready.","prompt":"slight smile, hair moves","source_image_url":"' +
        STILL +
        '"}\n```',
      emptyMotionCard(),
    );
    assert.match(parsed.reply, /Ready/);
    assert.equal(parsed.card.source_image_url, STILL);
    assert.match(parsed.card.prompt, /slight smile/);
  });
});

describe("MOTION_CARD_SYSTEM_PROMPT", () => {
  it("forbids Comfy / Seedance / LatentSync claims and names the real stack", () => {
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /Never mention ComfyUI/);
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /wan-i2v|first frame/i);
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /FLF2V|last-frame/);
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /Do not invent ByteDance Seedance/);
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /LatentSync/);
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /skeleton video/);
    assert.doesNotMatch(MOTION_CARD_SYSTEM_PROMPT, /InstantID|face_lock|UltraSharp/);
  });
});

describe("isMotionRecipe", () => {
  it("does not treat Qwen stills as motion", () => {
    assert.equal(isMotionRecipe("qwen-image-edit-2511"), false);
    assert.equal(isMotionRecipe(MOTION_RECIPE_I2V), true);
    assert.equal(isMotionRecipe(MOTION_RECIPE_FLF2V), true);
  });
});
