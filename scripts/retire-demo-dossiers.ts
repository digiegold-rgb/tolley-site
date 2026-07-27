// Retire the 4 May-2026 [DEMO] seed-fixture dossier scores (queue item zpwtt0).
// Reversible: full rows backed up at business-os/data/demo-dossiers-backup-20260726.json.
// Archives motivationScore into customData, nulls the live score, appends DEMO_FIXTURE flag.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const IDS = [
  "cmoth6kx10003l4pvbcnbt7zl", // 82
  "cmoth6lbn000jl4pvyx9rzpgr", // 25
  "cmoth6l87000fl4pvkjmwlgvn", // 68
  "cmoth6l4q000bl4pvf3wpk8tl", // 71
];

async function main() {
  for (const id of IDS) {
    const row = await prisma.dossierResult.findUnique({
      where: { id },
      select: { id: true, motivationScore: true, motivationFlags: true, customData: true, entityName: true },
    });
    if (!row) {
      console.log(`SKIP ${id}: not found`);
      continue;
    }
    if (row.motivationFlags.includes("DEMO_FIXTURE") && row.motivationScore === null) {
      console.log(`SKIP ${id}: already retired`);
      continue;
    }
    const customData = {
      ...(typeof row.customData === "object" && row.customData !== null ? row.customData : {}),
      archivedMotivationScore: row.motivationScore,
      archivedReason: "DEMO_FIXTURE retired 2026-07-27 (queue zpwtt0)",
    };
    await prisma.dossierResult.update({
      where: { id },
      data: {
        motivationScore: null,
        motivationFlags: { set: [...new Set([...row.motivationFlags, "DEMO_FIXTURE"])] },
        customData,
      },
    });
    console.log(`RETIRED ${id} (${row.entityName ?? "?"}) score ${row.motivationScore} -> null`);
  }
  const remaining = await prisma.dossierResult.count({ where: { motivationScore: { gte: 50 } } });
  console.log(`Dossiers with score >= 50 remaining: ${remaining}`);
}

main().finally(() => prisma.$disconnect());
