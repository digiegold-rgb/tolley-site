/**
 * Backfill (2026-08-12): library numbering.
 *  1. Migrate legacy (userId null) rows from the plain "#N — " prefix the
 *     first backfill pass gave them to the collision-free "#LN — " form.
 *  2. Run ensureVideoNumbers over everything (idempotent).
 * Usage: npx tsx --env-file=.env scripts/tmp-vater-number-library.ts
 */
import { prisma } from "@/lib/prisma";
import { ensureVideoNumbers } from "@/lib/vater/video-number";

async function main() {
  // Step 1: legacy prefix migration "#N — " -> "#LN — "
  const legacy = await prisma.youTubeProject.findMany({
    where: { projectType: "youtube", userId: null },
    select: { id: true, sourceTitle: true },
  });
  let migrated = 0;
  for (const r of legacy) {
    const m = /^#(\d+)\s*—\s*/.exec(r.sourceTitle ?? "");
    if (m) {
      const rest = (r.sourceTitle ?? "").slice(m[0].length);
      await prisma.youTubeProject.update({
        where: { id: r.id },
        data: { sourceTitle: `#L${m[1]} — ${rest}` },
      });
      migrated++;
    }
  }
  console.log(`legacy migrated to #L form: ${migrated}`);

  // Step 2: idempotent sweep over the full youtube lane
  const rows = await prisma.youTubeProject.findMany({
    where: { projectType: "youtube" },
    orderBy: { createdAt: "asc" },
  });
  await ensureVideoNumbers(rows);
  for (const r of rows.filter((r) => r.userId !== null)) {
    console.log(`${r.userId}\t${r.id}\t${r.sourceTitle}`);
  }
  console.log(`total rows: ${rows.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
