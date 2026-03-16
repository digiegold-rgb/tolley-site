import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deposits = [
    { assetClass: "crypto", amount: 10000, note: "Initial crypto deposit" },
    { assetClass: "stocks", amount: 10000, note: "Initial stocks deposit" },
    { assetClass: "alt", amount: 10000, note: "Initial alt deposit" },
  ];

  for (const d of deposits) {
    // Check if initial deposit already exists
    const existing = await prisma.tradingCapitalFlow.findFirst({
      where: {
        assetClass: d.assetClass,
        flowType: "deposit",
        amount: d.amount,
        note: d.note,
      },
    });

    if (existing) {
      console.log(`[skip] ${d.assetClass} $${d.amount} deposit already exists`);
      continue;
    }

    await prisma.tradingCapitalFlow.create({
      data: {
        assetClass: d.assetClass,
        flowType: "deposit",
        amount: d.amount,
        currency: "USD",
        note: d.note,
      },
    });
    console.log(`[created] ${d.assetClass} $${d.amount} deposit`);
  }

  // Verify
  const all = await prisma.tradingCapitalFlow.findMany({
    orderBy: { createdAt: "desc" },
  });
  console.log(`\nTotal capital flows: ${all.length}`);
  for (const f of all) {
    console.log(`  ${f.assetClass} | ${f.flowType} | $${f.amount} | ${f.note}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
