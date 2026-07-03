#!/usr/bin/env tsx
/**
 * Animate a Hero Still → Seamless Looping MP4 via LTX-Video 2B Distilled (DGX Spark)
 *
 * Second step of the Filatov / Video-2 "cinematic animated websites" workflow.
 * Takes a still image produced by gen-hero-comfy.ts (or any PNG), feeds it to
 * LTX-Video 2B Distilled FP8 on the local DGX via ComfyUI :8188, and saves a
 * short MP4 loop ready for a <video autoplay loop muted> hero background.
 *
 * Everything runs locally. No API calls, no billing, no external deps beyond
 * ComfyUI already being up (via creator-mode.sh draft or creator).
 *
 * Usage:
 *   npx tsx scripts/animate-hero-comfy.ts \
 *     --image public/heroes/homepage-2026-04-08-xyz.png \
 *     --prompt "Slow aerial drift over suburban neighborhood at blue hour, subtle parallax" \
 *     --frames 97 \
 *     --fps 25 \
 *     --size 1280x720
 */

import { promises as fs } from "fs";
import path from "path";

// ─── Config ─────────────────────────────────────────────────────

const COMFY_URL = process.env.COMFY_URL || "http://127.0.0.1:8188";

// LTX-Video 2B distilled FP8 — fast, fits in draft-mode VRAM (~33 GB free
// with vLLM still running). Lives in ComfyUI's checkpoints/ dir.
const LTXV_CHECKPOINT =
  process.env.LTXV_CHECKPOINT || "ltxv-2b-0.9.8-distilled-fp8.safetensors";

// ─── CLI parsing ────────────────────────────────────────────────

interface Args {
  image: string;
  prompt: string;
  negative: string;
  frames: number;
  fps: number;
  size: string;
  steps: number;
  seed: number;
  prefix: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      out[key] =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    }
  }
  if (!out.image) {
    console.error("Missing --image <path>");
    process.exit(1);
  }
  return {
    image: out.image,
    prompt:
      out.prompt ||
      "Subtle cinematic motion, slow gentle aerial drift, atmospheric haze shifting softly, warm window lights flickering gently, dreamy ambient movement",
    negative:
      out.negative ||
      "static, still, frozen, jitter, warp, distortion, flicker, text, watermark",
    frames: parseInt(out.frames || "97", 10),
    fps: parseInt(out.fps || "25", 10),
    size: out.size || "1280x720",
    steps: parseInt(out.steps || "8", 10), // Distilled → few steps
    seed: parseInt(out.seed || String(Math.floor(Math.random() * 1e9)), 10),
    prefix: out.prefix || "homepage-loop",
  };
}

// ─── ComfyUI client ─────────────────────────────────────────────

async function uploadImage(filePath: string): Promise<string> {
  // ComfyUI has a POST /upload/image endpoint that stores the file under its
  // input/ dir and returns the saved filename which LoadImage can then
  // reference. This is the canonical way to push a local image in.
  const abs = path.resolve(filePath);
  const data = await fs.readFile(abs);
  const basename = path.basename(abs);

  // Multipart form payload built manually — keeps us free of formidable/etc.
  const boundary = "----tolleyComfyBoundary" + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${basename}"\r\nContent-Type: image/png\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([
    Buffer.from(head),
    data,
    Buffer.from(tail),
  ]);

  const res = await fetch(`${COMFY_URL}/upload/image`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    throw new Error(`ComfyUI /upload/image returned ${res.status}: ${await res.text()}`);
  }
  const j = (await res.json()) as { name?: string; subfolder?: string; type?: string };
  if (!j.name) throw new Error(`Upload response missing name: ${JSON.stringify(j)}`);
  return j.name;
}

async function queuePrompt(workflow: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`ComfyUI /prompt returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { prompt_id?: string };
  if (!data.prompt_id) {
    throw new Error(`ComfyUI /prompt missing prompt_id: ${JSON.stringify(data)}`);
  }
  return data.prompt_id;
}

interface HistoryEntry {
  outputs?: Record<
    string,
    {
      images?: Array<{ filename: string; subfolder: string; type: string }>;
      videos?: Array<{ filename: string; subfolder: string; type: string }>;
    }
  >;
  status?: { completed?: boolean };
}

async function waitForCompletion(promptId: string, timeoutMs: number): Promise<HistoryEntry> {
  const deadline = Date.now() + timeoutMs;
  let lastLogged = 0;
  const start = Date.now();
  while (Date.now() < deadline) {
    const res = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (res.ok) {
      const history = (await res.json()) as Record<string, HistoryEntry>;
      const entry = history[promptId];
      if (entry?.status?.completed) return entry;
    }
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (elapsed - lastLogged >= 10) {
      console.log(`[animate-hero]   …still rendering (${elapsed}s elapsed)`);
      lastLogged = elapsed;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`ComfyUI render timed out after ${timeoutMs}ms`);
}

async function downloadFile(
  filename: string,
  subfolder: string,
  type: string,
): Promise<Buffer> {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${COMFY_URL}/view?${params.toString()}`);
  if (!res.ok) throw new Error(`ComfyUI /view ${res.status} for ${filename}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── LTX-Video workflow ─────────────────────────────────────────

function buildLtxWorkflow(args: {
  uploadedImageName: string;
  prompt: string;
  negative: string;
  width: number;
  height: number;
  length: number;
  fps: number;
  steps: number;
  seed: number;
  filenamePrefix: string;
}): Record<string, unknown> {
  return {
    // LTX-Video checkpoint (model + VAE, no CLIP — T5 loaded separately)
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: LTXV_CHECKPOINT },
    },
    // T5 text encoder for LTX-Video (loaded separately since checkpoint has no CLIP)
    "12": {
      class_type: "CLIPLoader",
      inputs: { clip_name: "models_t5_umt5-xxl-enc-bf16.pth", type: "ltxv" },
    },
    // Load the hero still we uploaded
    "2": {
      class_type: "LoadImage",
      inputs: { image: args.uploadedImageName },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["12", 0], text: args.prompt },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["12", 0], text: args.negative },
    },
    // Image → video latent. This node burns the first frame of the latent
    // video with the input image and sets it up for temporal sampling.
    "5": {
      class_type: "LTXVImgToVideo",
      inputs: {
        positive: ["3", 0],
        negative: ["4", 0],
        vae: ["1", 2],
        image: ["2", 0],
        width: args.width,
        height: args.height,
        length: args.length,
        batch_size: 1,
        strength: 1.0,
      },
    },
    // LTX-specific conditioning that attaches frame_rate to the cond tensors
    "6": {
      class_type: "LTXVConditioning",
      inputs: {
        positive: ["5", 0],
        negative: ["5", 1],
        frame_rate: args.fps,
      },
    },
    // LTX-specific model sampling wrapper for proper temporal noise schedule
    "7": {
      class_type: "ModelSamplingLTXV",
      inputs: {
        model: ["1", 0],
        max_shift: 2.05,
        base_shift: 0.95,
      },
    },
    "8": {
      class_type: "KSampler",
      inputs: {
        model: ["7", 0],
        seed: args.seed,
        steps: args.steps,
        cfg: 1.0, // Distilled models → CFG ≈ 1
        sampler_name: "euler",
        scheduler: "normal",
        positive: ["6", 0],
        negative: ["6", 1],
        latent_image: ["5", 2],
        denoise: 1.0,
      },
    },
    "9": {
      class_type: "VAEDecode",
      inputs: { samples: ["8", 0], vae: ["1", 2] },
    },
    // IMAGE batch → VIDEO type (needed for SaveVideo)
    "10": {
      class_type: "CreateVideo",
      inputs: {
        images: ["9", 0],
        fps: args.fps,
      },
    },
    // Final MP4 / h264 output
    "11": {
      class_type: "SaveVideo",
      inputs: {
        video: ["10", 0],
        filename_prefix: args.filenamePrefix,
        format: "mp4",
        codec: "h264",
      },
    },
  };
}

// ─── Orchestrator ───────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const [width, height] = args.size.split("x").map((n) => parseInt(n, 10));
  if (!width || !height) throw new Error(`Invalid --size "${args.size}"`);

  // LTX latent length must be (8k + 1) frames
  const length =
    args.frames % 8 === 1 ? args.frames : Math.floor(args.frames / 8) * 8 + 1;
  const durationSec = (length / args.fps).toFixed(2);

  console.log(
    `[animate-hero] src=${args.image} size=${width}x${height} frames=${length} fps=${args.fps} duration=${durationSec}s steps=${args.steps}`,
  );
  console.log(`[animate-hero] prompt: ${args.prompt}`);

  // 1. Sanity-check ComfyUI
  try {
    const ping = await fetch(`${COMFY_URL}/system_stats`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
  } catch (err) {
    console.error(`[animate-hero] ✗ ComfyUI unreachable at ${COMFY_URL}: ${(err as Error).message}`);
    console.error(`[animate-hero]   Start: creator-mode.sh draft`);
    process.exit(1);
  }

  // 2. Upload the still image to ComfyUI's input/ dir
  console.log(`[animate-hero] Uploading ${args.image}...`);
  const uploadedName = await uploadImage(args.image);
  console.log(`[animate-hero]   uploaded as ${uploadedName}`);

  // 3. Build + submit workflow
  const workflow = buildLtxWorkflow({
    uploadedImageName: uploadedName,
    prompt: args.prompt,
    negative: args.negative,
    width,
    height,
    length,
    fps: args.fps,
    steps: args.steps,
    seed: args.seed,
    filenamePrefix: args.prefix,
  });

  const promptId = await queuePrompt(workflow);
  console.log(`[animate-hero] prompt_id=${promptId} seed=${args.seed}`);

  // LTX 2B distilled at 1280x720 × 97 frames × 8 steps on GB10: usually
  // 90-300s. 15-minute ceiling is generous.
  const entry = await waitForCompletion(promptId, 900_000);

  // 4. Save the MP4
  const saveOutput = entry.outputs?.["11"];
  const videos = saveOutput?.videos || [];
  if (videos.length === 0) {
    throw new Error(`SaveVideo produced no videos: ${JSON.stringify(entry.outputs)}`);
  }

  const outDir = path.resolve(process.cwd(), "public", "heroes");
  await fs.mkdir(outDir, { recursive: true });

  for (const v of videos) {
    const buf = await downloadFile(v.filename, v.subfolder, v.type);
    const finalPath = path.join(outDir, path.basename(v.filename));
    await fs.writeFile(finalPath, buf);
    const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
    console.log(`[animate-hero]   ✓ ${finalPath} (${sizeMB} MB)`);
  }

  console.log(`[animate-hero] Done. MP4 in ${outDir}`);
  console.log(
    `[animate-hero] Next: drop it into components/homepage/hp-hero.tsx as a <video autoplay loop muted playsinline> background`,
  );
}

main().catch((err) => {
  console.error("[animate-hero] FATAL:", err);
  process.exit(1);
});
