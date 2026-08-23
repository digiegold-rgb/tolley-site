// Read-only audit (2026-08-23): which Styles render stills on firered-local (broken on the DGX — no GGUF on disk)?
import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.youTubeStyle.findMany({
    select: { id: true, name: true, defaultQuality: true, userId: true },
    orderBy: { createdAt: "desc" },
  });
  const byQ: Record<string, number> = {};
  for (const r of rows) byQ[String(r.defaultQuality)] = (byQ[String(r.defaultQuality)] || 0) + 1;
  console.log("defaultQuality histogram:", byQ);
  console.log("system styles:");
  for (const r of rows.filter((r) => (r.userId === null))) console.log(`  ${r.id} ${r.name} → ${r.defaultQuality}`);
  console.log("non-system styles with null/firered-local:");
  for (const r of rows.filter((r) => r.userId !== null && (!r.defaultQuality || r.defaultQuality === "firered-local")))
    console.log(`  ${r.id} ${r.name} (${r.userId}) → ${r.defaultQuality}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
