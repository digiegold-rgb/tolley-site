import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("modal/qwen_image_edit.py", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../modal/qwen_image_edit.py"),
    "utf8",
  );

  it("is the named BF16 Qwen-Image-Edit-2511 recipe with proven kwargs", () => {
    assert.match(src, /APP_NAME = "tolley-qwen-image-edit"/);
    assert.match(src, /FUNCTION_NAME = "qwen_image_edit"/);
    assert.match(src, /QwenImageEditPlusPipeline/);
    assert.match(src, /Qwen\/Qwen-Image-Edit-2511/);
    assert.match(src, /torch\.bfloat16/);
    assert.match(src, /num_inference_steps: int = 40/);
    assert.match(src, /height: int = 1664/);
    assert.match(src, /width: int = 928/);
    assert.match(src, /true_cfg_scale: float = 4\.0/);
    assert.match(src, /guidance_scale: float = 1\.0/);
    assert.match(src, /max_sequence_length: int = 512/);
    assert.match(src, /identity_ref_urls/);
    assert.match(src, /extra_image_urls/);
    assert.match(src, /sigmas/);
    assert.match(src, /num_images: int = 1/);
    assert.match(src, /urls \+ extras/);
    assert.match(src, /inputs\["sigmas"\]/);
    assert.match(src, /"max_sequence_length": int\(max_sequence_length\)/);
    assert.match(src, /attention_kwargs: dict\[str, Any\] \| None = None/);
    assert.match(src, /pipe_overrides: dict \| None = None/);
    assert.match(src, /_is_blocked_override_key/);
    assert.match(src, /Offending keys/);
    assert.match(src, /token\|secret\|password\|api_key\|authorization\|hf_/);
    assert.doesNotMatch(src, /InstantID|face_lock|UltraSharp|ComfyUI/);
    assert.match(src, /Do NOT assume Spark paths/);
  });
});
