import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const total = await p.product.count({ where: { status: "listed" } });
  const withAsin = await p.product.count({ where: { status: "listed", amazonAsin: { not: null } } });
  console.log(`listed: ${total}  with amazonAsin: ${withAsin}`);
  await p.$disconnect();
})();
