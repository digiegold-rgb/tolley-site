import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const products = await p.product.findMany({
    where: { status: "listed" },
    select: { title: true, targetPrice: true },
    orderBy: { createdAt: "desc" },
  });
  for (const x of products) {
    console.log(`$${(x.targetPrice ?? 0).toFixed(0).padStart(4)}  ${x.title}`);
  }
  await p.$disconnect();
})();
