#!/usr/bin/env tsx
/**
 * Generate the 13:13 Weddings & Events gallery photos via Gemini (Vertex AI).
 *
 * ComfyUI FLUX2 was too slow (12-min timeouts while vllm + Wan2.2 queue blocked
 * the GPU). Gemini Imagen is fast (~10s per image) and produces clean editorial
 * wedding photos.
 *
 * The real Emily & Trevor portrait (cropped from the brochure About-Us page)
 * stays the about-section image. This script only replaces the gallery.
 *
 * Run with:
 *   GCP_SA_KEY_JSON="$(cat ~/.config/gcp-keys/vertex-gemini-hero.json)" \
 *     npx tsx scripts/gen-wedding-photos-gemini.ts
 */

import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { generateImage } from "../lib/vertex-gemini";

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";

interface PhotoSpec {
  slug: string;
  alt: string;
  span: 1 | 2;
  aspect: "16:9" | "9:16" | "4:3" | "3:4" | "1:1";
  prompt: string;
}

const STYLE =
  "Editorial wedding photography, sage green and cream and brushed brass palette, soft golden-hour light, photorealistic, Kodak Portra 400 film aesthetic, intimate faith-led modern wedding, fine art, shallow depth of field, no text, no watermark, no logos, no captions, real photograph not illustration";

const SPECS: PhotoSpec[] = [
  {
    slug: "ceremony-arch-sunset",
    alt: "Wooden ceremony arch draped with sage greenery and blush roses at sunset, no people",
    span: 2,
    aspect: "4:3",
    prompt:
      "A wooden cross-style wedding ceremony arch on green grass at golden hour, draped with eucalyptus and lush sage greenery, soft blush and ivory roses cascading down the posts, two white pedestal urns flanking the arch, a small communion table with white linen beneath, warm late-afternoon sun, soft pink and lavender sky, wide angle, no people in frame. " +
      STYLE,
  },
  {
    slug: "sweetheart-table-candles",
    alt: "Sweetheart table set with cream candles in brass holders and eucalyptus garland",
    span: 1,
    aspect: "3:4",
    prompt:
      "An intimate sweetheart wedding table for two seen from a three-quarter angle, layered cream linen tablecloth, two cream taper candles softly lit in brushed-brass candlesticks, a long eucalyptus and white-rose garland down the center, gold-rimmed glassware, vintage cream menu cards, two white upholstered chairs partially visible, evening soft tungsten lighting, sage and brass accents. " +
      STYLE,
  },
  {
    slug: "bridal-bouquet-rings",
    alt: "Bride's bouquet of cream roses and eucalyptus resting beside two gold wedding bands",
    span: 1,
    aspect: "1:1",
    prompt:
      "Top-down photograph of a bridal bouquet of cream and ivory garden roses, white anemones, soft blush ranunculus, sage eucalyptus and olive leaves, tied with a long silk ivory ribbon, resting on a worn cream wooden table next to a folded sage napkin and a small open velvet box holding two gold wedding bands, soft morning window light, no people, no text. " +
      STYLE,
  },
  {
    slug: "cross-altar-candles",
    alt: "Wooden cross altar with cream candles and soft greenery at a quiet outdoor ceremony",
    span: 1,
    aspect: "16:9",
    prompt:
      "A small simple wooden cross at the front of an outdoor faith-led wedding ceremony altar, two pillar candles in brushed brass holders on either side, soft sage greenery and white ranunculus at the base, blurred rows of empty cream-cushioned chiavari chairs in the background, late afternoon golden light filtering through tree leaves, peaceful and contemplative, no people. " +
      STYLE,
  },
  {
    slug: "first-dance-string-lights",
    alt: "Bride and groom slow dancing beneath warm Edison-bulb string lights at an outdoor reception",
    span: 2,
    aspect: "4:3",
    prompt:
      "Wide candid photograph of a bride in a soft ivory A-line gown dancing with her groom in a charcoal suit, photographed from a respectful distance, warm Edison-bulb string lights overhead, soft blurred laughing guests at long farmhouse tables in the background, evening twilight, outdoor garden reception with sage and white floral centerpieces visible, cinematic warm tones, faces softly out of focus, no clear identifiable likeness. " +
      STYLE,
  },
  {
    slug: "reception-toast",
    alt: "Guests raising champagne glasses in a toast under warm string lights at an outdoor reception",
    span: 1,
    aspect: "1:1",
    prompt:
      "A candid joyful moment of a small group of wedding guests raising champagne flutes in a toast at an outdoor evening reception, warm Edison string lights overhead, soft blurred reception background of long farmhouse tables with cream linens and eucalyptus runners, golden bokeh, laughter and smiles, faces respectfully out of focus and partially turned away with no clear identifiable likeness, sage and brass accents. " +
      STYLE,
  },
];

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

  type Generated = { slug: string; alt: string; span: 1 | 2; width: number; height: number; blurDataURL: string };
  const generated: Generated[] = [];

  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i];
    console.log(`\n[${i + 1}/${SPECS.length}] ${spec.slug} (${spec.aspect})`);
    const existing1600 = path.join(outDir, `${spec.slug}-1600.webp`);
    try {
      const existingBuf = await fs.readFile(existing1600);
      const meta = await sharp(existingBuf).metadata();
      const blur = await blurDataURL(existingBuf);
      generated.push({
        slug: spec.slug,
        alt: spec.alt,
        span: spec.span,
        width: meta.width || 1024,
        height: meta.height || 1024,
        blurDataURL: blur,
      });
      console.log(`  ↺ reusing existing ${meta.width}×${meta.height} (already on disk)`);
      continue;
    } catch {
      // Not generated yet — fall through to actually generate it
    }
    console.log(`  ${spec.prompt.slice(0, 110)}…`);
    try {
      const result = await (async () => {
        let lastErr: unknown;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await generateImage({
              model: MODEL,
              prompt: spec.prompt,
              aspectRatio: spec.aspect,
              timeoutMs: 180_000,
            });
          } catch (e) {
            lastErr = e;
            console.log(`    attempt ${attempt} failed: ${(e as Error).message}, retrying…`);
          }
        }
        throw lastErr;
      })();
      const meta = await sharp(result.buffer).metadata();
      await emitTriplets(result.buffer, spec.slug, outDir);
      const blur = await blurDataURL(result.buffer);
      generated.push({
        slug: spec.slug,
        alt: spec.alt,
        span: spec.span,
        width: meta.width || 1024,
        height: meta.height || 1024,
        blurDataURL: blur,
      });
      console.log(`  ✓ ${meta.width}×${meta.height} (${(result.buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
    }
  }

  if (generated.length === 0) {
    console.error("\n✗ No photos generated. Manifest NOT modified.");
    process.exit(1);
  }

  // Rewrite photos.ts — preserve emily-trevor-portrait first (about-section)
  const manifestPath = path.join(repo, "components", "wedding", "data", "photos.ts");
  const existing = await fs.readFile(manifestPath, "utf8");
  const portraitMatch = existing.match(/\{[^{}]*"id":\s*"emily-trevor-portrait"[\s\S]*?\}/);
  if (!portraitMatch) {
    console.error("\n✗ emily-trevor-portrait entry not found in photos.ts — aborting manifest rewrite");
    process.exit(1);
  }
  const portraitEntry = portraitMatch[0];

  const galleryRows = generated.map(
    (g) =>
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

  const content =
    "// AUTOGENERATED by scripts/gen-wedding-photos-gemini.ts — do not edit by hand.\n" +
    "// Gallery photos generated via Gemini Imagen; about-section portrait is the\n" +
    "// real cropped brochure photo of Emily & Trevor (preserved verbatim).\n\n" +
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
    portraitEntry +
    ",\n" +
    galleryRows.join(",\n") +
    "\n];\n";

  await fs.writeFile(manifestPath, content);
  console.log(`\n✓ ${generated.length} photos generated. Manifest at ${manifestPath}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
