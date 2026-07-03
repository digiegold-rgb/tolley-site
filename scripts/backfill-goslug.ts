import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function slugify(title: string, idTail: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "item"}-${idTail}`;
}

(async () => {
  const products = await prisma.product.findMany({
    where: { goSlug: null },
    select: { id: true, title: true },
  });
  console.log(`Backfilling ${products.length} goSlug values…`);
  for (const p of products) {
    const slug = slugify(p.title, p.id.slice(-6));
    try {
      await prisma.product.update({ where: { id: p.id }, data: { goSlug: slug } });
    } catch {
      const fallback = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      await prisma.product.update({ where: { id: p.id }, data: { goSlug: fallback } });
    }
  }
  console.log("done");
  await prisma.$disconnect();
})();
