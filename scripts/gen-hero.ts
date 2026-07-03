#!/usr/bin/env tsx
/**
 * Nano Banana (Gemini Image) hero image generator via Vertex AI.
 *
 * Routes through Vertex AI with a GCP service account, not AI Studio's
 * generativelanguage endpoint — the latter gets trapped by AI Studio's
 * prepaid-tier billing mode even when the underlying GCP project has billing
 * enabled. See lib/vertex-gemini.ts for token mint + call details.
 *
 * Usage:
 *   GCP_SA_KEY_JSON="$(cat ~/.config/gcp-keys/vertex-gemini-hero.json)" \
 *     npx tsx scripts/gen-hero.ts \
 *     --prompt "Ultra-modern KC real estate brokerage storefront at golden hour..." \
 *     --route water \
 *     --size 1920x1080
 *
 * Outputs to public/heroes/<route>-<timestamp>.png.
 */

import { promises as fs } from "fs";
import path from "path";
import { generateImage as vertexImage } from "../lib/vertex-gemini";

const GEMINI_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";

interface Args {
  prompt: string;
  route: string;
  size: string;
  count: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    }
  }
  return {
    prompt: out.prompt || "Clean modern hero image for a real estate AI SaaS landing page",
    route: out.route || "test",
    size: out.size || "1920x1080",
    count: parseInt(out.count || "1", 10),
  };
}

function aspectRatioFor(width: number, height: number): "1:1" | "16:9" | "9:16" | "4:3" | "3:4" {
  const r = width / height;
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (Math.abs(r - 16 / 9) < 0.1) return "16:9";
  if (Math.abs(r - 9 / 16) < 0.1) return "9:16";
  if (Math.abs(r - 4 / 3) < 0.1) return "4:3";
  if (Math.abs(r - 3 / 4) < 0.1) return "3:4";
  return r >= 1 ? "16:9" : "9:16";
}

async function generateImage(prompt: string, size: string): Promise<Buffer> {
  const [width, height] = size.split("x").map((n) => parseInt(n, 10));
  if (!width || !height) {
    throw new Error(`Invalid --size "${size}", expected WIDTHxHEIGHT`);
  }

  const fullPrompt = `Generate a single photorealistic hero image, ${width}x${height} aspect ratio, professional quality suitable for a landing page. Style: clean, editorial, cinematic lighting, subtle depth of field. Subject: ${prompt}. No text overlays, no watermarks, no logos.`;

  const { buffer } = await vertexImage({
    model: GEMINI_MODEL,
    prompt: fullPrompt,
    temperature: 0.8,
    aspectRatio: aspectRatioFor(width, height),
  });
  return buffer;
}

async function main() {
  const args = parseArgs();
  console.log(
    `[gen-hero] route=${args.route} size=${args.size} count=${args.count} model=${GEMINI_MODEL}`,
  );
  console.log(`[gen-hero] prompt: ${args.prompt}`);

  const outDir = path.resolve(process.cwd(), "public", "heroes");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 0; i < args.count; i++) {
    console.log(`[gen-hero] Generating ${i + 1}/${args.count}...`);
    try {
      const img = await generateImage(args.prompt, args.size);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const suffix = args.count > 1 ? `-${i + 1}` : "";
      const filename = `${args.route}-${timestamp}${suffix}.png`;
      const filePath = path.join(outDir, filename);
      await fs.writeFile(filePath, img);
      const sizeMB = (img.length / 1024 / 1024).toFixed(2);
      console.log(`[gen-hero] ✓ Wrote ${filePath} (${sizeMB} MB)`);
    } catch (err) {
      console.error(
        `[gen-hero] ✗ Failed ${i + 1}/${args.count}:`,
        (err as Error).message,
      );
    }
  }

  console.log(`[gen-hero] Done. Files in ${outDir}`);
}

main().catch((err) => {
  console.error("[gen-hero] FATAL:", err);
  process.exit(1);
});
