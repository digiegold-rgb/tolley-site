import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("/generate still delivery", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const studio = readFileSync(join(root, "app/generate/generate-studio.tsx"), "utf8");
  const persist = readFileSync(join(root, "lib/generate-output-persist.ts"), "utf8");
  const modalTs = readFileSync(join(root, "lib/generate-modal.ts"), "utf8");
  const imageRoute = readFileSync(
    join(root, "app/api/generate/jobs/[id]/image/route.ts"),
    "utf8",
  );

  it("studio and persist never publish public Blob job outputs", () => {
    assert.match(studio, /function stillSrc\(/);
    assert.match(studio, /\/api\/generate\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/image\?i=/);
    assert.doesNotMatch(studio, /public\.blob\.vercel-storage/);
    assert.match(persist, /access: "private"/);
    assert.doesNotMatch(persist, /access:\s*["']public["']/);
    assert.doesNotMatch(modalTs, /access:\s*"public"/);
    assert.match(imageRoute, /requireGenerateAdmin/);
    assert.match(imageRoute, /fetchStoredJobImage/);
  });
});

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
    assert.match(src, /_put_private_blob/);
    assert.match(src, /GENERATE_BLOB_FALLBACK/);
    assert.match(src, /x-vercel-blob-access": "private"/);
    assert.match(src, /_webhook_payload/);
    assert.match(src, /outputs_ready/);
    assert.match(src, /Authorization.*Bearer/);
    assert.doesNotMatch(src, /_put_blob\(/);
  });
});
