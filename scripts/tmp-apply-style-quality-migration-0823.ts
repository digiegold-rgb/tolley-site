// One-off (2026-08-23): apply prisma/migrations/20260823_style_quality_modal_default by hand
// (this repo applies migrations manually) and print the before/after histogram.
import { prisma } from "../lib/prisma";

async function hist() {
  const rows = await prisma.youTubeStyle.groupBy({ by: ["defaultQuality"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.defaultQuality, r._count._all]));
}
async function main() {
  console.log("before:", await hist());
  await prisma.$executeRawUnsafe(`ALTER TABLE "YouTubeStyle" ALTER COLUMN "defaultQuality" SET DEFAULT 'firered-modal'`);
  const n = await prisma.$executeRawUnsafe(`UPDATE "YouTubeStyle" SET "defaultQuality" = 'firered-modal' WHERE "defaultQuality" = 'firered-local'`);
  console.log("rows updated:", n);
  console.log("after:", await hist());
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
