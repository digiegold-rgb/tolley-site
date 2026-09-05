import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { JOB_CARD_SYSTEM_PROMPT, isJobCardLlmConfigured } from "./generate-job-llm.ts";

describe("JOB_CARD_SYSTEM_PROMPT", () => {
  it("asks for JSON only and keeps the Lady2 / proven-default recipe", () => {
    assert.match(JOB_CARD_SYSTEM_PROMPT, /JSON object/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /lady2-lacy-pink-front-smile/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /width=928/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /true_cfg_scale=4\.0/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /No credentials/);
    assert.doesNotMatch(JOB_CARD_SYSTEM_PROMPT, /InstantID|face_lock|UltraSharp/i);
  });

  it("forbids ComfyUI/node advice and allows every job-card kwarg via chat", () => {
    assert.match(JOB_CARD_SYSTEM_PROMPT, /Never mention ComfyUI/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /node graphs/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /\.safetensors/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /open the Comfy interface/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /Modal kwargs \/ job-card form fields only/);
    for (const field of [
      "seed",
      "num_inference_steps",
      "width",
      "height",
      "true_cfg_scale",
      "guidance_scale",
      "max_sequence_length",
      "num_images",
      "negative_prompt",
      "identity_ref_urls",
      "extra_image_urls",
      "sigmas",
      "attention_kwargs",
      "pipe_overrides",
      "modal_kwargs",
      "prompt",
    ]) {
      assert.match(JOB_CARD_SYSTEM_PROMPT, new RegExp(field));
    }
    assert.match(JOB_CARD_SYSTEM_PROMPT, /NO denoise\/strength/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /no denoise/i);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /Allow NSFW/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /Block NSFW/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /allow-nsfw-wardrobe/);
    assert.match(JOB_CARD_SYSTEM_PROMPT, /Never remove child\/minor/);
  });
});

describe("isJobCardLlmConfigured", () => {
  it("accepts LiteLLM or Qwen vLLM and does not require Modal tokens", () => {
    assert.equal(isJobCardLlmConfigured({}), false);
    assert.equal(isJobCardLlmConfigured({ LITELLM_API_URL: "https://llm.example/v1" }), true);
    assert.equal(isJobCardLlmConfigured({ LLM_API_URL: "https://api.openai.com/v1" }), true);
    assert.equal(isJobCardLlmConfigured({ QWEN_VLLM_BASE_URL: "http://127.0.0.1:8357/v1" }), true);
    assert.equal(isJobCardLlmConfigured({ MODAL_TOKEN_ID: "ak-x", MODAL_TOKEN_SECRET: "as-y" }), false);
  });
});


describe("fillJobCardFromChat model preference", () => {
  it("documents Spark Qwen preference over LiteLLM kimi defaults", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "generate-job-llm.ts"), "utf8");
    assert.match(src, /prefer Spark Qwen/);
    const qwenIdx = src.indexOf("if (isQwenConfigured(env))");
    const litellmIdx = src.indexOf("if (llmBase(env))");
    assert.ok(qwenIdx > 0 && litellmIdx > qwenIdx, "Qwen branch must run before LiteLLM");
  });
});
