import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GENERATE_JOB_CARD_KEYS,
  GENERATE_RECIPE,
  HISTORICAL_IDENTITY_REF_PATHS,
  LADY2_LACY_PINK_PRESET_ID,
  LADY2_LACY_PINK_PROMPT,
  MODAL_SPAWN_KWARG_KEYS,
  PROVEN_DEFAULTS,
  SEED_MAX,
  applyPreset,
  cardToModalKwargs,
  defaultIdentityRefUrls,
  defaultJobCard,
  extractJsonObject,
  formatJobCardJson,
  mergeJobCard,
  parseGenerateJobCard,
  parseJobCardJson,
  parseLlmJobCard,
  randomSeed,
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

  it("forwards every recipe kwarg including guidance_scale, negative_prompt, identity URLs, num_images", () => {
    const card = parseGenerateJobCard({
      prompt: "photoreal Lady2, red dress, same face",
      negative_prompt: "identity drift, watermark",
      seed: 12,
      num_inference_steps: 32,
      width: 768,
      height: 1344,
      true_cfg_scale: 3.5,
      guidance_scale: 1.2,
      num_images: 3,
      identity_ref_urls: [
        "https://blob.example/front.jpg",
        "https://blob.example/left.jpg",
        "https://blob.example/right.jpg",
      ],
    });
    const kw = cardToModalKwargs(card);
    assert.equal(kw.prompt, card.prompt);
    assert.equal(kw.negative_prompt, "identity drift, watermark");
    assert.equal(kw.seed, 12);
    assert.equal(kw.num_inference_steps, 32);
    assert.equal(kw.width, 768);
    assert.equal(kw.height, 1344);
    assert.equal(kw.true_cfg_scale, 3.5);
    assert.equal(kw.guidance_scale, 1.2);
    assert.equal(kw.num_images, 3);
    assert.deepEqual(kw.identity_ref_urls, card.identity_ref_urls);
    for (const key of MODAL_SPAWN_KWARG_KEYS) {
      assert.equal(Object.hasOwn(kw, key), true, `missing Modal kwarg ${key}`);
    }
  });
});

describe("chat JSON → card → Modal kwargs", () => {
  it("accepts a full chat JSON patch for every editable field", () => {
    const base = defaultJobCard(LADY2_LACY_PINK_PRESET_ID, {});
    const parsed = parseLlmJobCard(
      JSON.stringify({
        reply: "Patched the card.",
        prompt: "photoreal Lady2, navy swimsuit, same face",
        negative_prompt: "child, watermark",
        seed: 99,
        num_inference_steps: 28,
        width: 832,
        height: 1472,
        true_cfg_scale: 4.5,
        guidance_scale: 1.4,
        num_images: 2,
        identity_ref_urls: [
          "https://blob.example/front.jpg",
          "https://blob.example/left.jpg",
          "https://blob.example/right.jpg",
        ],
      }),
      base,
    );
    assert.equal(parsed.card.guidance_scale, 1.4);
    assert.equal(parsed.card.negative_prompt, "child, watermark");
    assert.equal(parsed.card.num_images, 2);
    assert.equal(parsed.card.seed, 99);
    const kw = cardToModalKwargs(parsed.card);
    assert.equal(kw.guidance_scale, 1.4);
    assert.equal(kw.negative_prompt, "child, watermark");
    assert.equal(kw.num_images, 2);
    assert.deepEqual(kw.identity_ref_urls, parsed.card.identity_ref_urls);
  });
});

describe("Advanced JSON + random seed", () => {
  it("round-trips the full GenerateJobCard", () => {
    const card = defaultJobCard(LADY2_LACY_PINK_PRESET_ID, {
      GENERATE_IDENTITY_REF_FRONT_URL: "https://blob.example/front.jpg",
      GENERATE_IDENTITY_REF_LEFT_URL: "https://blob.example/left.jpg",
      GENERATE_IDENTITY_REF_RIGHT_URL: "https://blob.example/right.jpg",
    });
    const json = formatJobCardJson(card);
    const back = parseJobCardJson(json);
    assert.deepEqual(back, card);
    for (const key of GENERATE_JOB_CARD_KEYS) {
      assert.equal(Object.hasOwn(back, key) || back[key] === undefined, true);
    }
    assert.throws(() => parseJobCardJson("{not json"), /not valid JSON/);
    assert.throws(() => parseJobCardJson(JSON.stringify({ prompt: "" })));
  });

  it("randomSeed stays in the Modal integer range", () => {
    assert.equal(randomSeed(() => 0), 0);
    const high = randomSeed(() => 0.999999999);
    assert.equal(Number.isInteger(high), true);
    assert.ok(high >= 0 && high <= SEED_MAX);
    const n = randomSeed();
    assert.equal(Number.isInteger(n), true);
    assert.ok(n >= 0 && n <= SEED_MAX);
  });
});
