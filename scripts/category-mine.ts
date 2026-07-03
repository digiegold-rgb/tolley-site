import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const products = await p.product.findMany({
    where: { status: "listed" },
    select: { title: true, category: true, brand: true, targetPrice: true },
  });

  const byCat = new Map<string, number>();
  const byBrand = new Map<string, number>();
  const wordFreq = new Map<string, number>();

  const stop = new Set([
    "the","a","an","and","or","with","for","of","in","on","by","to",
    "new","used","good","great","nice","mint","like","brand","set","piece","pieces",
    "size","large","medium","small","big","mini","x","xl","xxl",
  ]);

  for (const prod of products) {
    byCat.set(prod.category || "—", (byCat.get(prod.category || "—") || 0) + 1);
    if (prod.brand) {
      byBrand.set(prod.brand, (byBrand.get(prod.brand) || 0) + 1);
    }
    for (const w of prod.title.toLowerCase().match(/[a-z]{4,}/g) || []) {
      if (stop.has(w)) continue;
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }
  }

  console.log(`Total listed: ${products.length}\n`);

  console.log("BY CATEGORY:");
  [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));

  console.log("\nTOP BRANDS:");
  [...byBrand.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));

  console.log("\nTOP TITLE KEYWORDS (≥3 mentions):");
  [...wordFreq.entries()]
    .filter(([, v]) => v >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 35)
    .forEach(([k, v]) => console.log(`  ${v.toString().padStart(3)}  ${k}`));

  await p.$disconnect();
})();
