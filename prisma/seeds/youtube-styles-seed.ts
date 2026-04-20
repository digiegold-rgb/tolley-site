/**
 * Seeds 16 system-owned YouTubeStyle rows from the existing
 * STYLE_PRESETS list. System rows have userId=null + isSystem=true,
 * are public-read, immutable. Users clone them via the
 * /api/vater/youtube/styles/{id}/clone endpoint to get an editable
 * copy.
 *
 * Idempotent: re-running upserts based on a deterministic seed id
 * (style:system:<presetId>). Safe to run on every deploy.
 */
import { PrismaClient } from "@prisma/client";
import { STYLE_PRESETS } from "../../lib/vater/style-presets";

const prisma = new PrismaClient();

const SYSTEM_ID_PREFIX = "style-sys-";

async function main() {
  let upsertedCount = 0;
  for (const preset of STYLE_PRESETS) {
    const id = `${SYSTEM_ID_PREFIX}${preset.id}`;
    await prisma.youTubeStyle.upsert({
      where: { id },
      create: {
        id,
        userId: null,
        name: preset.name,
        emoji: preset.emoji,
        artStylePresetId: preset.id,
        isSystem: true,
        // Reasonable defaults — system rows are starting points, not
        // opinionated about voice/word count. Users adjust on clone.
        voice: "MorganDeep",
        voiceBackend: "f5-tts",
        defaultWordCount: 1500,
        defaultAspectRatio: "16x9",
        defaultQuality: "sdxl-local",
        defaultVisualType: "images",
        defaultAnimMode: "none",
        defaultConsistency: preset.id === "animated_explainer" ? 70 : 0,
        defaultPacingSec: preset.id === "animated_explainer" ? 2.5 : null,
      },
      update: {
        // Keep the system row's name + emoji + artStylePresetId in sync
        // with the canonical preset list. NEVER touch user-set fields.
        name: preset.name,
        emoji: preset.emoji,
        artStylePresetId: preset.id,
      },
    });
    upsertedCount++;
  }
  console.log(`✅ Seeded ${upsertedCount} system YouTubeStyle rows`);
}

main()
  .catch((e) => {
    console.error("❌ youtube-styles-seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
