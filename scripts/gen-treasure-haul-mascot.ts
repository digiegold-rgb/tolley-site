/**
 * One-off mascot generator for Ruthann's Treasure Haul FB page.
 * Uses Gemini Nano-Banana (gemini-2.5-flash-image) via existing vertex-gemini lib.
 * Run: npx tsx scripts/gen-treasure-haul-mascot.ts
 */
import { config as dotenvConfig } from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
dotenvConfig({ path: path.join(__dirname, "..", ".env.local") });
import { generateImage } from "../lib/vertex-gemini";

const OUT_DIR = path.join(__dirname, "..", "public", "branding", "ruthanns-treasure-haul");
mkdirSync(OUT_DIR, { recursive: true });

const PROMPT = `A cheerful cartoon mascot character: a friendly female detective inspired by Inspector Gadget, modernized and sticker-style. She wears a long khaki/tan trench coat, a deerstalker detective hat, and round glasses. She holds a giant magnifying glass in one hand and a vintage shopping bag overflowing with treasures (small lamp, picture frame, ceramic vase, a stuffed animal, a glowing gem) in the other. Big bright friendly smile, rosy cheeks, expressive eyes, slight wave to her short auburn hair peeking out of the hat.

Style: bold-line cartoon mascot, like a high-quality animated sticker — thick black outlines, flat shading with soft cell-shaded highlights, slightly chunky proportions (cute, not realistic). Modern Pixar-meets-Saturday-morning-cartoon energy, NOT anime, NOT realistic.

Color palette: deep purple trench coat accents (#7c3aed), warm amber/gold price-tag accent (#FFB13A), white inner highlights, black outlines. Treasure bag has a "$" tag dangling. Background: completely transparent / pure white. Centered, full body, facing slightly to the right with confident pose. No text, no logo, no signature.`;

async function main() {
  console.log("Generating Treasure Haul mascot via Gemini 2.5 Flash Image…");
  const variants = 4;
  for (let i = 1; i <= variants; i++) {
    console.log(`  Variant ${i}/${variants}…`);
    try {
      const result = await generateImage({
        model: "gemini-2.5-flash-image",
        prompt: PROMPT,
        temperature: 0.95,
        timeoutMs: 90_000,
      });
      const out = path.join(OUT_DIR, `mascot-v${i}.png`);
      writeFileSync(out, result.buffer);
      console.log(`  ✓ Saved ${out} (${result.buffer.length} bytes, ${result.mimeType})`);
    } catch (err) {
      console.error(`  ✗ Variant ${i} failed:`, err instanceof Error ? err.message : err);
    }
  }
  console.log("\nReview variants in:", OUT_DIR);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
