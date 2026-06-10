// Import scraped prospects into GrowthLead.
// Usage (from tolley-site/): node --env-file=.env.local scripts/import-growth-prospects.mjs <path-to-prospects.json>
// Upserts by placeId (fallback name+city); never resets stage on existing rows.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();
const file = process.argv[2] || "/home/jelly/business-os/data/prospects-2026-06-10.json";
const rows = JSON.parse(readFileSync(file, "utf8"));

let created = 0, updated = 0, skipped = 0;
for (const r of rows) {
  if (!r.name || !r.offer) { skipped++; continue; }
  const data = {
    name: r.name,
    offer: r.offer,
    category: r.category ?? null,
    address: r.address ?? null,
    city: r.city ?? null,
    phone: r.phone ?? null,
    website: r.website ?? null,
    websiteScore: r.websiteScore ?? null,
    websiteNotes: r.websiteNotes ?? null,
    rating: r.rating ?? null,
    reviews: r.reviews ?? null,
    score: r.score ?? null,
    source: r.source ?? "serpapi",
  };
  const existing = r.placeId
    ? await prisma.growthLead.findUnique({ where: { placeId: r.placeId } })
    : await prisma.growthLead.findFirst({ where: { name: r.name, city: r.city ?? undefined } });
  if (existing) {
    await prisma.growthLead.update({ where: { id: existing.id }, data });
    updated++;
  } else {
    await prisma.growthLead.create({ data: { ...data, placeId: r.placeId ?? null, stage: "scraped" } });
    created++;
  }
}
console.log(`import done: ${created} created, ${updated} updated, ${skipped} skipped (of ${rows.length})`);
await prisma.$disconnect();
