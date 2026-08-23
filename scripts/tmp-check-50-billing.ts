// Read-only (2026-08-23): confirm #50 / F5-2CRZHY billing path.
// Expected for tvater326 (studio, unmetered, lane=vater): ZERO credit-ledger
// debit; cost truth in project.costJson; the project counts toward the
// delivered-minutes settlement (Vater due) instead.
import { prisma } from "../lib/prisma";

const USER = "cmnzgxvoy0000l4r6fyuatyku";
const PROJECT = "cmt6dlr8u0001ic04vj0vtvlj";

async function main() {
  const rows = await prisma.vaterCreditLedger.findMany({
    where: { userId: USER, createdAt: { gte: new Date("2026-08-23T00:00:00Z") } },
    select: { createdAt: true, deltaCents: true, kind: true, dedupeKey: true, note: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`credit-ledger rows for tvater326 today: ${rows.length}`);
  for (const r of rows) console.log(" ", r.createdAt.toISOString(), r.deltaCents, r.kind, r.dedupeKey, r.note);

  const debitAnytime = await prisma.vaterCreditLedger.findMany({
    where: { userId: USER, dedupeKey: { contains: PROJECT } },
    select: { deltaCents: true, kind: true, dedupeKey: true },
  });
  console.log(`ledger rows keyed to project ${PROJECT}: ${debitAnytime.length}`, debitAnytime);

  const p = await prisma.youTubeProject.findUnique({
    where: { id: PROJECT },
    select: { status: true, costJson: true, updatedAt: true },
  });
  console.log("project:", JSON.stringify(p, null, 1).slice(0, 600));
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
