#!/usr/bin/env tsx
/**
 * Generate the 13:13 Weddings & Events gallery photos locally via FLUX 2 on
 * ComfyUI (DGX). Replaces the brochure-cropped gallery shots — the brochure
 * paper edges were visible and looked unprofessional to a bride evaluating
 * planners.
 *
 * The real photo of Emily & Trevor (emily-trevor-portrait, cropped from the
 * brochure About-Us page) is preserved for the about-section image; this
 * script ONLY replaces the gallery.
 *
 * Outputs:
 *   public/e-and-t/photos/generated/{slug}-{800,1600,2400}.webp
 *   components/wedding/data/photos.ts  (regenerated with the new gallery set)
 *
 * Idempotent — re-run after tuning prompts.
 *
 * Workflow:
 *   1. Submit FLUX 2 Dev FP8 prompts to ComfyUI (port 8188)
 *   2. Download PNG, run through sharp to emit 800/1600/2400 WebP triplets
 *   3. Generate base64 blur placeholder
 *   4. Rewrite the photos.ts manifest (keeping emily-trevor-portrait first
 *      so it remains the About-section hero)
 */

import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const COMFY_URL = process.env.COMFY_URL || "http://127.0.0.1:8188";
const FLUX_UNET = "flux2-dev-fp8_scaled.safetensors";
const FLUX_CLIP = "mistral_3_small_flux2_fp8.safetensors";
const FLUX_VAE = "flux2-vae.safetensors";
const STEPS = 28;

interface PhotoSpec {
  slug: string;
  alt: string;
  span: 1 | 2;
  width: number;
  height: number;
  prompt: string;
}

// Aesthetic anchor for every prompt: sage + cream + brushed brass, faith-led,
// intimate, soft cinematic light. NO text in the image. NO logos. Photo-real.
const STYLE_TAIL =
  ", editorial wedding photography, soft natural light, sage green and cream and brushed brass color palette, photorealistic, shallow depth of field, Kodak Portra 400 film aesthetic, intimate, modern faith-led ceremony, fine art wedding, no text, no watermark, no logos, real photograph, no illustration";

const SPECS: PhotoSpec[] = [
  {
    slug: "ceremony-arch-sunset",
    alt: "Wooden ceremony arch draped with sage greenery and blush roses at sunset",
    span: 2,
    width: 1600,
    height: 1200,
    prompt:
      "A wooden cross-style wedding ceremony arch on green grass at golden hour, draped with eucalyptus and lush sage greenery, accents of soft blush and ivory roses cascading down the posts, two white pedestal urns flanking the arch, a small communion table with white linen and a single bouquet beneath the arch, warm late-afternoon sun, soft pink and lavender sky behind, wide angle, no people in frame" +
      STYLE_TAIL,
  },
  {
    slug: "sweetheart-table-candles",
    alt: "Sweetheart table set with cream candles in brass holders and eucalyptus garland",
    span: 1,
    width: 1400,
    height: 1750,
    prompt:
      "A close-up overhead three-quarter view of an intimate sweetheart wedding table for two, layered cream linen tablecloth, two cream taper candles in brushed-brass candlesticks softly lit, a long eucalyptus and soft white-rose garland down the center, gold-rimmed glassware, vintage menu cards, two white upholstered chairs slightly visible, evening soft tungsten lighting, sage and brass accents" +
      STYLE_TAIL,
  },
  {
    slug: "bridal-bouquet-and-rings",
    alt: "Bride's bouquet of cream roses and eucalyptus resting beside two gold wedding bands",
    span: 1,
    width: 1400,
    height: 1400,
    prompt:
      "Top-down macro photograph of a bridal bouquet of cream and ivory garden roses, white anemones, soft blush ranunculus, sage eucalyptus and olive leaves, tied with a long silk ivory ribbon, resting on a worn wooden table next to a folded sage napkin and a small open velvet box holding two gold wedding bands and an ornate brass wax-seal letter, soft morning window light, no people" +
      STYLE_TAIL,
  },
  {
    slug: "cross-altar-candles",
    alt: "Wooden cross altar with cream candles and soft greenery in a quiet chapel setting",
    span: 1,
    width: 1600,
    height: 1100,
    prompt:
      "A small simple wooden cross at the front of an outdoor faith-led ceremony altar, two pillar candles in brushed brass holders on either side, soft sage greenery and white ranunculus at the base, blurred rows of empty cream-cushioned chiavari chairs in the background, late afternoon golden light filtering through tree leaves, peaceful and contemplative, no people visible" +
      STYLE_TAIL,
  },
  {
    slug: "first-dance-string-lights",
    alt: "Bride and groom slow dancing beneath warm Edison-bulb string lights at an outdoor reception",
    span: 2,
    width: 1500,
    height: 1100,
    prompt:
      "A wide candid photograph of a bride in a soft ivory A-line gown dancing with her groom in a charcoal suit, both seen from a respectful distance, surrounded by warm Edison-bulb string lights overhead, blurred laughing guests in the background, evening twilight, outdoor garden reception with sage and white floral centerpieces visible, cinematic warm tones, faces softly blurred / partially turned away (no clear identifiable likeness)" +
      STYLE_TAIL,
  },
  {
    slug: "reception-toast-laughter",
    alt: "Guests raising champagne glasses in a toast under warm string lights at an outdoor reception",
    span: 1,
    width: 1400,
    height: 1200,
    prompt:
      "A candid joyful moment of a small group of wedding guests raising champagne flutes in a toast at an outdoor evening reception, warm Edison string lights overhead, soft blurred reception background of long farmhouse tables with cream linens and eucalyptus runners, golden bokeh, laughter and genuine smiles, faces respectfully out of focus and partially turned away (no clear identifiable likeness), sage and brass accents" +
      STYLE_TAIL,
  },
];

interface HistoryEntry {
  outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
  status?: { completed?: boolean };
}

function buildWorkflow(prompt: string, width: number, height: number, seed: number, prefix: string) {
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: FLUX_UNET, weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: FLUX_CLIP, type: "flux2" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: FLUX_VAE } },
    "4": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: prompt } },
    "5": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: "" } },
    "6": { class_type: "EmptyFlux2LatentImage", inputs: { width, height, batch_size: 1 } },
    "7": { class_type: "Flux2Scheduler", inputs: { steps: STEPS, width, height } },
    "8": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "9": { class_type: "BasicGuider", inputs: { model: ["1", 0], conditioning: ["4", 0] } },
    "10": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "11": {
      class_type: "SamplerCustomAdvanced",
      inputs: { noise: ["10", 0], guider: ["9", 0], sampler: ["8", 0], sigmas: ["7", 0], latent_image: ["6", 0] },
    },
    "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
    "13": { class_type: "SaveImage", inputs: { images: ["12", 0], filename_prefix: prefix } },
  };
}

async function queuePrompt(workflow: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`/prompt ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { prompt_id?: string };
  if (!data.prompt_id) throw new Error("missing prompt_id");
  return data.prompt_id;
}

async function waitForCompletion(promptId: string, timeoutMs: number): Promise<HistoryEntry> {
  const deadline = Date.now() + timeoutMs;
  let lastLog = 0;
  while (Date.now() < deadline) {
    const res = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (res.ok) {
      const history = (await res.json()) as Record<string, HistoryEntry>;
      const entry = history[promptId];
      if (entry?.status?.completed) return entry;
    }
    const elapsedSec = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
    if (elapsedSec - lastLog >= 10) {
      console.log(`    …rendering (${elapsedSec}s)`);
      lastLog = elapsedSec;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`timed out after ${timeoutMs}ms`);
}

async function downloadImage(filename: string, subfolder: string, type: string): Promise<Buffer> {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${COMFY_URL}/view?${params.toString()}`);
  if (!res.ok) throw new Error(`/view ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function emitTriplets(src: Buffer, slug: string, outDir: string) {
  for (const w of [800, 1600, 2400]) {
    const dest = path.join(outDir, `${slug}-${w}.webp`);
    await sharp(src)
      .resize(w, null, { withoutEnlargement: true })
      .webp({ quality: w === 2400 ? 80 : 86, effort: 6 })
      .toFile(dest);
  }
}

async function blurDataURL(src: Buffer): Promise<string> {
  const small = await sharp(src).resize(12).webp({ quality: 40 }).toBuffer();
  return "data:image/webp;base64," + small.toString("base64");
}

async function main() {
  const repo = path.resolve(process.cwd());
  const outDir = path.join(repo, "public", "e-and-t", "photos", "generated");
  await fs.mkdir(outDir, { recursive: true });

  // Sanity-ping ComfyUI
  try {
    const r = await fetch(`${COMFY_URL}/system_stats`, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error(`✗ ComfyUI not reachable at ${COMFY_URL}: ${(e as Error).message}`);
    console.error(`  Start with: creator-mode.sh draft`);
    process.exit(1);
  }

  type Generated = { slug: string; alt: string; span: 1 | 2; width: number; height: number; blurDataURL: string };
  const generated: Generated[] = [];

  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i];
    console.log(`\n[${i + 1}/${SPECS.length}] ${spec.slug}`);
    console.log(`  ${spec.prompt.slice(0, 120)}…`);
    const seed = 13_130_000 + i * 7919;
    const prefix = `et-${spec.slug}`;
    try {
      const promptId = await queuePrompt(
        buildWorkflow(spec.prompt, spec.width, spec.height, seed, prefix),
      );
      console.log(`  prompt_id=${promptId} seed=${seed}`);
      const entry = await waitForCompletion(promptId, 12 * 60 * 1000);
      const out = entry.outputs?.["13"];
      if (!out?.images?.length) throw new Error(`no images in output: ${JSON.stringify(entry.outputs)}`);
      const img = out.images[0];
      const buf = await downloadImage(img.filename, img.subfolder, img.type);
      await emitTriplets(buf, spec.slug, outDir);
      const blur = await blurDataURL(buf);
      const meta = await sharp(buf).metadata();
      generated.push({
        slug: spec.slug,
        alt: spec.alt,
        span: spec.span,
        width: meta.width || spec.width,
        height: meta.height || spec.height,
        blurDataURL: blur,
      });
      console.log(`  ✓ ${meta.width}x${meta.height} → ${path.relative(repo, outDir)}/${spec.slug}-*.webp`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${(err as Error).message}`);
    }
  }

  // Rewrite photos.ts: keep emily-trevor-portrait first (for about), then the gallery generated set
  const manifestPath = path.join(repo, "components", "wedding", "data", "photos.ts");
  const existing = await fs.readFile(manifestPath, "utf8");
  const portraitMatch = existing.match(
    /\{\s*"id":\s*"emily-trevor-portrait"[\s\S]*?\}\s*,?/,
  );
  if (!portraitMatch) {
    console.error("✗ Could not locate emily-trevor-portrait entry in photos.ts — aborting manifest rewrite.");
    return;
  }
  const portraitEntry = portraitMatch[0].replace(/,\s*$/, "");

  const galleryEntries = generated.map((g) =>
    [
      "  {",
      `    "id": ${JSON.stringify(g.slug)},`,
      `    "width": ${g.width},`,
      `    "height": ${g.height},`,
      `    "ratio": ${(g.width / g.height).toFixed(4)},`,
      `    "blurDataURL": ${JSON.stringify(g.blurDataURL)},`,
      `    "alt": ${JSON.stringify(g.alt)},`,
      `    "span": ${g.span},`,
      `    "src": ${JSON.stringify(`/e-and-t/photos/generated/${g.slug}`)}`,
      "  }",
    ].join("\n"),
  );

  const newContent =
    "// AUTOGENERATED by scripts/gen-wedding-photos.ts — do not edit by hand.\n" +
    "// Gallery photos generated via FLUX 2 on local ComfyUI; about-section\n" +
    "// portrait is the real cropped brochure photo of Emily & Trevor.\n\n" +
    "export type WeddingPhoto = {\n" +
    "  id: string;\n" +
    "  width: number;\n" +
    "  height: number;\n" +
    "  ratio: number;\n" +
    "  blurDataURL: string;\n" +
    "  alt: string;\n" +
    "  span?: 1 | 2;\n" +
    "  src: string;\n" +
    "};\n\n" +
    "export const PHOTOS: WeddingPhoto[] = [\n" +
    portraitEntry + ",\n" +
    galleryEntries.join(",\n") + "\n" +
    "];\n";

  await fs.writeFile(manifestPath, newContent);
  console.log(`\nManifest written: ${manifestPath}`);
  console.log(`Generated ${generated.length} gallery photos. About portrait preserved.`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
