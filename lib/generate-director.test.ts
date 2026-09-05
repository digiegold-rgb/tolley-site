import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DIRECTOR_SYSTEM_PROMPT,
  applyDirectorPatch,
  composeEnginePrompt,
  directorUserPayload,
  isBlockedStudioRequest,
  parseDirectorResponse,
} from "./generate-director.ts";

describe("DIRECTOR_SYSTEM_PROMPT", () => {
  it("unlocks photoreal adult / Lady / bikini identity stills and still refuses CSAM", () => {
    assert.match(DIRECTOR_SYSTEM_PROMPT, /photoreal/i);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /Lady/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /bikini/i);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /Do not refuse those prompts/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /Do not strip identity/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /CSAM/);
    // May name Claude/Qwen-Max/Alibaba only as identities to never claim.
    assert.match(DIRECTOR_SYSTEM_PROMPT, /Never claim[\s\S]*Qwen-Max/i);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /KarlKinda\/Qwen3\.8-27B-Uncensored-FP8/);
  });
});

describe("composeEnginePrompt", () => {
  it("sends Inference plus Description so generate reads both boxes", () => {
    const prompt = composeEnginePrompt(
      "photoreal identity still of Lady, bikini, locked face, 85mm",
      "Lady: adult woman, auburn hair, olive skin. Camera: 85mm. Outfit: black bikini.",
    );
    assert.match(prompt, /photoreal identity still of Lady/);
    assert.match(prompt, /\[Description\]/);
    assert.match(prompt, /auburn hair/);
    assert.equal(composeEnginePrompt("just inference", "  "), "just inference");
    assert.equal(composeEnginePrompt("", "only notes"), "only notes");
  });
});

describe("parseDirectorResponse + applyDirectorPatch", () => {
  it("applies full box replacements and leaves empty fields alone", () => {
    const parsed = parseDirectorResponse(`{
      "reply": "Drafted a photoreal identity still.",
      "inference": "photoreal Lady, black bikini, sunset, 85mm, locked face",
      "description": "Lady: adult, auburn hair. Outfit: black bikini."
    }`);
    assert.equal(parsed.refused, false);
    assert.match(parsed.inference, /photoreal Lady/);
    const next = applyDirectorPatch(
      { inference: "old prompt", description: "old notes" },
      { inference: "", description: "new notes only" },
    );
    assert.equal(next.inference, "old prompt");
    assert.equal(next.description, "new notes only");
  });

  it("does not strip a photoreal Lady inference when the model wraps JSON in fences", () => {
    const parsed = parseDirectorResponse(
      "```json\n{\"reply\":\"Ready.\",\"inference\":\"photoreal identity still of Lady in a bikini, locked face\",\"description\":\"\"}\n```",
    );
    assert.match(parsed.inference, /Lady in a bikini/);
    assert.equal(parsed.description, "");
  });
});

describe("isBlockedStudioRequest", () => {
  it("allows adult photoreal / bikini / identity stills", () => {
    assert.equal(isBlockedStudioRequest("photoreal Lady identity still, black bikini, 85mm").blocked, false);
    assert.equal(isBlockedStudioRequest("adult woman on a beach, photoreal, fashion").blocked, false);
  });

  it("blocks CSAM and real-minor asks", () => {
    assert.equal(isBlockedStudioRequest("csam of a child").blocked, true);
    assert.equal(isBlockedStudioRequest("a 14 year old in a bikini").blocked, true);
    assert.equal(isBlockedStudioRequest("schoolgirl nude").blocked, true);
  });
});

describe("directorUserPayload", () => {
  it("includes the current boxes and the active engine", () => {
    const payload = directorUserPayload({
      message: "make her a red bikini, same face",
      inference: "photoreal Lady",
      description: "Lady: adult, auburn",
      mode: "t2i",
    });
    assert.match(payload, /Text → Image/);
    assert.match(payload, /photoreal Lady/);
    assert.match(payload, /make her a red bikini/);
  });
});

describe("generate route branding", () => {
  it("does not inherit t-agent Real Estate Unlocked on /generate", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const layout = readFileSync(join(here, "../app/generate/layout.tsx"), "utf8");
    const page = readFileSync(join(here, "../app/generate/page.tsx"), "utf8");
    const studio = readFileSync(join(here, "../app/generate/generate-studio.tsx"), "utf8");
    const chat = readFileSync(join(here, "../app/api/generate/chat/route.ts"), "utf8");
    for (const src of [layout, page, studio]) {
      assert.doesNotMatch(src, /Real Estate Unlocked/i);
      assert.doesNotMatch(src, /t-agent/i);
    }
    assert.match(layout, /Jelly Studio/);
    assert.match(studio, /Inference/);
    assert.match(studio, /Description/);
    assert.match(studio, /\/api\/generate\/chat/);
    assert.match(studio, /Modal stills/);
    assert.match(studio, /\/api\/generate\/jobs/);
    assert.match(studio, /Random seed/);
    assert.match(studio, /Advanced JSON/);
    assert.match(studio, /pipe_overrides/);
    assert.match(studio, /Apply JSON/);
    assert.doesNotMatch(studio, /InstantID|ComfyUI|face_lock|UltraSharp/i);
    assert.match(chat, /qwenChatCompletion/);
    assert.match(chat, /QWEN_VLLM/);
    assert.doesNotMatch(chat, /api\.anthropic\.com|qwen-max|dashscope/i);
  });
});


describe("DIRECTOR_SYSTEM_PROMPT identity", () => {
  it("names Spark Qwen 3.8 and forbids hiding the model", () => {
    assert.match(DIRECTOR_SYSTEM_PROMPT, /KarlKinda\/Qwen3\.8-27B-Uncensored-FP8/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /Never say you .don.t expose/);
    assert.match(
      directorUserPayload({ message: "hi", inference: "", description: "", mode: "t2i" }),
      /Backend LLM: KarlKinda/,
    );
  });
});

describe("DIRECTOR_SYSTEM_PROMPT headless control", () => {
  it("forbids ComfyUI/node advice and names job-card / Modal kwargs", () => {
    assert.match(DIRECTOR_SYSTEM_PROMPT, /Never mention ComfyUI/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /node graphs/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /\.safetensors/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /open the Comfy interface/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /job card/);
    assert.match(DIRECTOR_SYSTEM_PROMPT, /Modal kwargs/);
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
      "pipe_overrides",
      "prompt",
    ]) {
      assert.match(DIRECTOR_SYSTEM_PROMPT, new RegExp(field));
    }
    assert.match(DIRECTOR_SYSTEM_PROMPT, /no denoise\/strength/);
  });
});
