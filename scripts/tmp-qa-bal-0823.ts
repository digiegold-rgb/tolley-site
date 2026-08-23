// QA-only (2026-08-23): balance check + small grant for the fable5-runner headless proof ticket.
import { prisma } from "../lib/prisma";

async function main() {
  const u = await prisma.user.findUnique({ where: { email: "qa.walkthrough.0820@tolley.io" }, select: { id: true } });
  if (!u) throw new Error("QA user missing");
  const rows = await prisma.vaterCreditLedger.findMany({ where: { userId: u.id }, select: { deltaCents: true, kind: true, expiresAt: true } });
  const bal = rows.reduce((a, r) => a + r.deltaCents, 0);
  console.log("rows", rows.length, "balance cents", bal);
  if (bal < 300) {
    await prisma.vaterCreditLedger.create({
      data: {
        userId: u.id,
        deltaCents: 500,
        kind: "grant",
        expiresAt: null,
        stillsOnly: false,
        dedupeKey: "qa-walkthrough-grant-0823-runner-proof",
        note: "QA: fable5-runner headless proof (not a customer)",
      },
    });
    console.log("granted +500c");
  }
}
main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
