#!/usr/bin/env tsx
/**
 * Local Hero Image Generator — FLUX 2 Dev via ComfyUI (DGX Spark)
 *
 * Same goal as gen-hero.ts (Nano Banana) but runs 100% locally on the DGX
 * Spark through ComfyUI on port 8188. Zero API cost per image, no billing
 * activation required, same Video-2 workflow (AI-gen hero → Next.js hero slot).
 *
 * Prerequisites:
 *   - ComfyUI must be running on port 8188. Start it with:
 *       creator-mode.sh draft    (keeps vLLM alive, ~33 GB free for FLUX)
 *       creator-mode.sh creator  (stops vLLM for maximum quality)
 *
 * Usage:
 *   npx tsx scripts/gen-hero-comfy.ts \
 *     --prompt "Pristine modern pool at golden hour..." \
 *     --route water \
 *     --size 1920x1080 \
 *     --count 3 \
 *     --steps 25
 *
 * Outputs to public/heroes/<route>-<timestamp>-<n>.png.
 */

import { promises as fs } from "fs";
import path from "path";

// ─── Config ─────────────────────────────────────────────────────

const COMFY_URL = process.env.COMFY_URL || "http://127.0.0.1:8188";

// FLUX 2 Dev FP8 is the flagship image model currently installed on the DGX.
// Alternatives that will also work if the Dev model is too heavy:
//   - "flux-2-klein-4b-fp8.safetensors" (FLUX 2 Klein, ~4B params, faster)
const FLUX_UNET = process.env.FLUX_UNET || "flux2-dev-fp8_scaled.safetensors";
const FLUX_CLIP = process.env.FLUX_CLIP || "mistral_3_small_flux2_fp8.safetensors";
const FLUX_VAE = process.env.FLUX_VAE || "flux2-vae.safetensors";

// ─── CLI parsing ────────────────────────────────────────────────

interface Args {
  prompt: string;
  route: string;
  size: string;
  count: number;
  steps: number;
  seed: number;
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
  return {
    prompt:
      out.prompt ||
      "Clean modern hero image for a real estate AI SaaS landing page",
    route: out.route || "test",
    size: out.size || "1920x1080",
    count: parseInt(out.count || "1", 10),
    steps: parseInt(out.steps || "25", 10),
    seed: parseInt(out.seed || String(Math.floor(Math.random() * 1e9)), 10),
  };
}

// ─── ComfyUI workflow ───────────────────────────────────────────

/**
 * Build a FLUX 2 Dev workflow graph. ComfyUI's /prompt API accepts a dict of
 * nodes keyed by integer-string IDs, each with `class_type` and `inputs`.
 * Node-to-node connections are expressed as [source_id, output_index].
 */
function buildFlux2Workflow(args: {
  prompt: string;
  width: number;
  height: number;
  steps: number;
  seed: number;
  filenamePrefix: string;
}): Record<string, unknown> {
  return {
    "1": {
      class_type: "UNETLoader",
      inputs: {
        unet_name: FLUX_UNET,
        weight_dtype: "default",
      },
    },
    "2": {
      class_type: "CLIPLoader",
      inputs: {
        clip_name: FLUX_CLIP,
        type: "flux2",
      },
    },
    "3": {
      class_type: "VAELoader",
      inputs: {
        vae_name: FLUX_VAE,
      },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["2", 0],
        text: args.prompt,
      },
    },
    "5": {
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["2", 0],
        text: "",
      },
    },
    "6": {
      class_type: "EmptyFlux2LatentImage",
      inputs: {
        width: args.width,
        height: args.height,
        batch_size: 1,
      },
    },
    "7": {
      class_type: "Flux2Scheduler",
      inputs: {
        steps: args.steps,
        width: args.width,
        height: args.height,
      },
    },
    "8": {
      class_type: "KSamplerSelect",
      inputs: {
        sampler_name: "euler",
      },
    },
    "9": {
      class_type: "BasicGuider",
      inputs: {
        model: ["1", 0],
        conditioning: ["4", 0],
      },
    },
    "10": {
      class_type: "RandomNoise",
      inputs: {
        noise_seed: args.seed,
      },
    },
    "11": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["10", 0],
        guider: ["9", 0],
        sampler: ["8", 0],
        sigmas: ["7", 0],
        latent_image: ["6", 0],
      },
    },
    "12": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["11", 0],
        vae: ["3", 0],
      },
    },
    "13": {
      class_type: "SaveImage",
      inputs: {
        images: ["12", 0],
        filename_prefix: args.filenamePrefix,
      },
    },
  };
}

// ─── ComfyUI client ─────────────────────────────────────────────

interface HistoryEntry {
  outputs?: Record<
    string,
    {
      images?: Array<{
        filename: string;
        subfolder: string;
        type: string;
      }>;
    }
  >;
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: unknown[];
  };
}

async function queuePrompt(
  workflow: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ComfyUI /prompt returned ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { prompt_id?: string; error?: unknown };
  if (!data.prompt_id) {
    throw new Error(`ComfyUI /prompt missing prompt_id: ${JSON.stringify(data)}`);
  }
  return data.prompt_id;
}

async function waitForCompletion(
  promptId: string,
  timeoutMs: number,
): Promise<HistoryEntry> {
  const deadline = Date.now() + timeoutMs;
  let lastLogged = 0;

  while (Date.now() < deadline) {
    const res = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (res.ok) {
      const history = (await res.json()) as Record<string, HistoryEntry>;
      const entry = history[promptId];
      if (entry?.status?.completed) return entry;
    }
    const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
    if (elapsed - lastLogged >= 10) {
      console.log(`[gen-hero-comfy]   …still rendering (${elapsed}s elapsed)`);
      lastLogged = elapsed;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`ComfyUI render timed out after ${timeoutMs}ms`);
}

async function downloadImage(
  filename: string,
  subfolder: string,
  type: string,
): Promise<Buffer> {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${COMFY_URL}/view?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`ComfyUI /view returned ${res.status} for ${filename}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ─── Orchestrator ───────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const [width, height] = args.size.split("x").map((n) => parseInt(n, 10));
  if (!width || !height) {
    throw new Error(`Invalid --size "${args.size}", expected WIDTHxHEIGHT`);
  }

  console.log(
    `[gen-hero-comfy] route=${args.route} size=${width}x${height} count=${args.count} steps=${args.steps}`,
  );
  console.log(`[gen-hero-comfy] model=${FLUX_UNET}`);
  console.log(`[gen-hero-comfy] prompt: ${args.prompt}`);

  // Sanity check ComfyUI is reachable before submitting anything.
  try {
    const ping = await fetch(`${COMFY_URL}/system_stats`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
  } catch (err) {
    console.error(
      `[gen-hero-comfy] ✗ ComfyUI not reachable at ${COMFY_URL}: ${(err as Error).message}`,
    );
    console.error(
      `[gen-hero-comfy]   Start it with: creator-mode.sh draft`,
    );
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), "public", "heroes");
  await fs.mkdir(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (let i = 0; i < args.count; i++) {
    console.log(`[gen-hero-comfy] Generating ${i + 1}/${args.count}...`);
    try {
      const seed = args.seed + i; // Distinct seed per image for variety
      const prefix = `${args.route}-${timestamp}-${i + 1}`;
      const workflow = buildFlux2Workflow({
        prompt: args.prompt,
        width,
        height,
        steps: args.steps,
        seed,
        filenamePrefix: prefix,
      });

      const promptId = await queuePrompt(workflow);
      console.log(`[gen-hero-comfy]   prompt_id=${promptId} seed=${seed}`);

      // FLUX 2 Dev on GB10: ~25 steps typically 60-180s for 1920x1080.
      // Give it 10 minutes of headroom.
      const entry = await waitForCompletion(promptId, 600_000);

      // Find the SaveImage node output (node "13")
      const saveOutput = entry.outputs?.["13"];
      if (!saveOutput?.images || saveOutput.images.length === 0) {
        throw new Error(
          `No images in SaveImage output: ${JSON.stringify(entry.outputs)}`,
        );
      }

      for (const img of saveOutput.images) {
        const buf = await downloadImage(img.filename, img.subfolder, img.type);
        const finalPath = path.join(outDir, img.filename);
        await fs.writeFile(finalPath, buf);
        const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
        console.log(`[gen-hero-comfy]   ✓ ${finalPath} (${sizeMB} MB)`);
      }
    } catch (err) {
      console.error(
        `[gen-hero-comfy]   ✗ Failed ${i + 1}/${args.count}:`,
        (err as Error).message,
      );
    }
  }

  console.log(`[gen-hero-comfy] Done. Files in ${outDir}`);
}

main().catch((err) => {
  console.error("[gen-hero-comfy] FATAL:", err);
  process.exit(1);
});
