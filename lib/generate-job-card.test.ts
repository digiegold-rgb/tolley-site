import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GENERATE_RECIPE,
  HISTORICAL_IDENTITY_REF_PATHS,
  LADY2_LACY_PINK_PRESET_ID,
  LADY2_LACY_PINK_PROMPT,
  PROVEN_DEFAULTS,
  applyPreset,
  cardToModalKwargs,
  defaultIdentityRefUrls,
  defaultJobCard,
  extractJsonObject,
  mergeJobCard,
  parseGenerateJobCard,
  parseLlmJobCard,
} from "./generate-job-card.ts";

describe("parseGenerateJobCard", () => {
  it("applies proven defaults and requires a prompt", () => {
    const card = parseGenerateJobCard({
      prompt: "photoreal Lady2, lacy pink, front smile",
    });
    assert.equal(card.recipe, GENERATE_RECIPE);
    assert.equal(card.width, 928);
    assert.equal(card.height, 1664);
    assert.equal(card.num_inference_steps, 40);
    assert.equal(card.true_cfg_scale, 4.0);
    assert.equal(card.guidance_scale, 1.0);
    assert.equal(card.num_images, 1);
    assert.throws(() => parseGenerateJobCard({ prompt: "" }));
  });

  it("accepts identity_ref_urls and strips blanks", () => {
    const card = parseGenerateJobCard({
      prompt: "x",
      identity_ref_urls: ["https://blob.example/front.jpg", "  ", "https://blob.example/left.jpg"],
    });
    assert.deepEqual(card.identity_ref_urls, [
      "https://blob.example/front.jpg",
      "https://blob.example/left.jpg",
    ]);
  });
});

describe("defaultJobCard + Lady2 preset", () => {
  it("loads Lady2 lacy pink front smile with env identity URLs, not Spark paths", () => {
    const card = defaultJobCard(LADY2_LACY_PINK_PRESET_ID, {
      GENERATE_IDENTITY_REF_FRONT_URL: "https://blob.example/front.jpg",
      GENERATE_IDENTITY_REF_LEFT_URL: "https://blob.example/left.jpg",
      GENERATE_IDENTITY_REF_RIGHT_URL: "https://blob.example/right.jpg",
    });
    assert.equal(card.preset, LADY2_LACY_PINK_PRESET_ID);
    assert.match(card.prompt, /lacy pink/i);
    assert.match(card.prompt, /grey-shirt identity/i);
    assert.equal(card.prompt, LADY2_LACY_PINK_PROMPT);
    assert.match(card.negative_prompt, /identity drift/);
    assert.deepEqual(card.identity_ref_urls, [
      "https://blob.example/front.jpg",
      "https://blob.example/left.jpg",
      "https://blob.example/right.jpg",
    ]);
    assert.doesNotMatch(card.identity_ref_urls.join(" "), /\/home\/jelly/);
    assert.match(HISTORICAL_IDENTITY_REF_PATHS.front, /persona-refs\/identity\/front\.jpg/);
  });

  it("reads packed GENERATE_IDENTITY_REF_URLS", () => {
    assert.deepEqual(
      defaultIdentityRefUrls({ GENERATE_IDENTITY_REF_URLS: "https://a, https://b, https://c" }),
      ["https://a", "https://b", "https://c"],
    );
  });
});

describe("merge + LLM parse", () => {
  it("merges a chat patch and leaves empty fields alone", () => {
    const base = defaultJobCard(LADY2_LACY_PINK_PRESET_ID, {});
    const merged = mergeJobCard(base, { seed: 42, prompt: "", num_inference_steps: 32 });
    assert.equal(merged.seed, 42);
    assert.equal(merged.prompt, base.prompt);
    assert.equal(merged.num_inference_steps, 32);
  });

  it("parses fenced LLM JSON into a card", () => {
    const base = defaultJobCard(null, {});
    const parsed = parseLlmJobCard(
      "```json\n{\"reply\":\"Ready.\",\"prompt\":\"photoreal Lady2 red dress, same face\",\"seed\":7}\n```",
      base,
    );
    assert.match(parsed.reply, /Ready/);
    assert.match(parsed.card.prompt, /red dress/);
    assert.equal(parsed.card.seed, 7);
    assert.equal(parsed.card.width, PROVEN_DEFAULTS.width);
  });

  it("extracts a nested card object", () => {
    const obj = extractJsonObject(`{"reply":"ok","card":{"prompt":"hi"}}`);
    assert.equal((obj?.card as { prompt: string }).prompt, "hi");
  });
});

describe("cardToModalKwargs", () => {
  it("emits the named kwargs Modal expects and no credentials", () => {
    const card = applyPreset(defaultJobCard(null, {}), LADY2_LACY_PINK_PRESET_ID);
    const kw = cardToModalKwargs(card, { job_id: "job_1", webhook_url: "https://tolley.io/api/generate/webhook" });
    assert.equal(kw.width, 928);
    assert.equal(kw.height, 1664);
    assert.equal(kw.num_inference_steps, 40);
    assert.equal(kw.true_cfg_scale, 4);
    assert.equal(kw.guidance_scale, 1);
    assert.equal(kw.job_id, "job_1");
    const dumped = JSON.stringify(kw);
    assert.doesNotMatch(dumped, /MODAL_TOKEN|HF_TOKEN|ak-|as-/);
  });
});
