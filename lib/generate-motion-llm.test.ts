import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MOTION_CARD_SYSTEM_PROMPT } from "./generate-motion-card.ts";

describe("MOTION_CARD_SYSTEM_PROMPT (llm module)", () => {
  it("allows every motion-card field via chat and forbids Comfy / secrets", () => {
    for (const field of [
      "prompt",
      "negative_prompt",
      "source_image_url",
      "end_image_url",
      "aspect",
      "seed",
    ]) {
      assert.match(MOTION_CARD_SYSTEM_PROMPT, new RegExp(field));
    }
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /Never mention ComfyUI/);
    assert.match(MOTION_CARD_SYSTEM_PROMPT, /No credentials/);
    assert.doesNotMatch(MOTION_CARD_SYSTEM_PROMPT, /FAL_KEY\s*=/);
  });
});

describe("fillMotionCardFromChat preference", () => {
  it("prefers Spark Qwen over LiteLLM and does not require FAL_KEY", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "generate-motion-llm.ts"), "utf8");
    assert.match(src, /isQwenConfigured/);
    const qwenIdx = src.indexOf("if (isQwenConfigured(env))");
    const litellmIdx = src.indexOf("if (llmBase(env))");
    assert.ok(qwenIdx > 0 && litellmIdx > qwenIdx, "Qwen branch must run before LiteLLM");
    assert.doesNotMatch(src, /FAL_KEY/);
  });
});
