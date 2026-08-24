// QA-only: mirror grantCredit's row shape without the server-only import chain.
import { prisma } from "../lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "qa.walkthrough.0820@tolley.io" }, select: { id: true } });
  if (!user) throw new Error("QA user missing");
  try {
    await prisma.vaterCreditLedger.create({
      data: {
        userId: user.id,
        deltaCents: 500,
        kind: "grant",
        expiresAt: null,
        stillsOnly: false,
        dedupeKey: "qa-walkthrough-grant-0820",
        note: "QA walkthrough test credit (not a customer)",
      },
    });
    console.log("granted 500c");
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") console.log("already granted");
    else throw e;
  }
  const rows = await prisma.vaterCreditLedger.findMany({ where: { userId: user.id }, select: { deltaCents: true, kind: true } });
  console.log("ledger:", rows);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
