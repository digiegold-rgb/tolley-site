import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_MOTION_NEGATIVE } from "./generate-motion-card.ts";
import { isBlockedStudioRequest } from "./generate-director.ts";
import {
  cinemaSpawnInput,
  kling3ElementsInput,
  klingPromptFromSeedance,
  seedanceRefInput,
} from "./generate-cinema-card.ts";
import { emptyCinemaQueue, loadEstateProofTemplate } from "./generate-cinema.ts";

const FRONT = "https://blob.example/estate-a/front.png";
const BUST = "https://blob.example/estate-a/bust.png";
const ID = "https://blob.example/identity/front.jpg";
const AUDIO = "https://blob.example/voice.wav";
const PREV = "https://blob.example/prev.mp4";

describe("Seedance / Kling request body shape", () => {
  it("emits Seedance reference-to-video kwargs (image/audio/video + generate_audio)", () => {
    const input = seedanceRefInput({
      prompt: 'Shot 1 (0-3s): @Image1 walks. She says exactly: "Welcome." @Audio1',
      imageUrls: [FRONT, BUST, ID],
      videoUrls: [PREV],
      audioUrls: [AUDIO],
      seconds: 10,
      generateAudio: true,
    });
    assert.deepEqual(input.image_urls, [FRONT, BUST, ID]);
    assert.deepEqual(input.video_urls, [PREV]);
    assert.deepEqual(input.audio_urls, [AUDIO]);
    assert.equal(input.aspect_ratio, "9:16");
    assert.equal(input.resolution, "720p");
    assert.equal(input.duration, "10");
    assert.equal(input.generate_audio, true);
    assert.match(input.prompt, /She says exactly/);
    assert.ok(!("enable_safety_checker" in input));
  });

  it("emits Kling 3 Pro elements with frontal + refs and @Element1", () => {
    const input = kling3ElementsInput({
      prompt: "Shot 1: @Image1 walks. @Image2 smiles. @Audio1",
      imageUrls: [FRONT, BUST, ID],
      seconds: 8,
      generateAudio: true,
      negativePrompt: DEFAULT_MOTION_NEGATIVE,
    });
    assert.equal(input.start_image_url, FRONT);
    assert.equal(input.duration, "8");
    assert.equal(input.generate_audio, true);
    assert.equal(input.shot_type, "customize");
    assert.equal(input.elements.length, 1);
    assert.equal(input.elements[0].frontal_image_url, BUST);
    assert.deepEqual(input.elements[0].reference_image_urls, [ID]);
    assert.match(input.prompt, /@Element1/);
    assert.doesNotMatch(input.prompt, /@Image1/);
    assert.match(input.negative_prompt, /\bchild\b/);
    assert.equal(isBlockedStudioRequest(input.prompt).blocked, false);
    assert.equal(isBlockedStudioRequest(input.negative_prompt).blocked, true);
  });

  it("always sets reference_image_urls when images are present (1–2 refs)", () => {
    const one = kling3ElementsInput({
      prompt: "Shot 1: @Image1 walks.",
      imageUrls: [FRONT],
      seconds: 3,
    });
    assert.equal(one.start_image_url, FRONT);
    assert.equal(one.elements[0].frontal_image_url, FRONT);
    assert.deepEqual(one.elements[0].reference_image_urls, [FRONT]);
    assert.equal(one.duration, "3");

    const two = kling3ElementsInput({
      prompt: "Shot 1: @Image1 walks.",
      imageUrls: [FRONT, BUST],
      seconds: 10,
    });
    assert.equal(two.elements[0].frontal_image_url, BUST);
    assert.ok(two.elements[0].reference_image_urls?.length);
    assert.deepEqual(two.elements[0].reference_image_urls, [FRONT]);

    const seed = seedanceRefInput({ prompt: "x", imageUrls: [FRONT], seconds: 3 });
    assert.equal(seed.duration, "4");
  });

  it("cinemaSpawnInput picks Seedance or Kling from the queue model", () => {
    const q = emptyCinemaQueue({
      image_urls: [FRONT, BUST, ID],
      audio_url: AUDIO,
      prior_video_url: PREV,
      model: "seedance",
    });
    const estate = loadEstateProofTemplate({ imageUrls: [FRONT, BUST, ID] });
    const seed = cinemaSpawnInput(q, estate.beats[0]);
    assert.equal(seed.falModelId, "seedance-ref");
    assert.equal(seed.recipe, "fal-seedance-ref");
    assert.ok("image_urls" in seed.input);
    const klingQ = { ...q, model: "kling" as const };
    const kling = cinemaSpawnInput(klingQ, estate.beats[0]);
    assert.equal(kling.falModelId, "kling3-elements");
    assert.ok("elements" in kling.input);
    assert.ok("start_image_url" in kling.input);
    if ("elements" in kling.input) {
      assert.ok(kling.input.elements[0].reference_image_urls?.length);
    }
    const oneStill = cinemaSpawnInput(
      emptyCinemaQueue({ image_urls: [FRONT], model: "kling" }),
      estate.beats[0],
    );
    assert.ok("elements" in oneStill.input);
    if ("elements" in oneStill.input) {
      assert.deepEqual(oneStill.input.elements[0].reference_image_urls, [FRONT]);
    }
  });
});
