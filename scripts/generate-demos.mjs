// Engine 1 — batch demo assignment for /demo/[slug] preview pages.
// Picks the top N prospects (by score) for an offer that are still
// stage=scraped, generates a unique kebab slug from name+city, and sets
// demoUrl="/demo/<slug>" + stage="demo_built". The page at app/demo/[slug]
// renders entirely from GrowthLead data — assigning the slug IS building
// the demo.
//
// Usage (from tolley-site/):
//   node --env-file=.env.local scripts/generate-demos.mjs --top 20 --offer site
//   node --env-file=.env.local scripts/generate-demos.mjs --dry-run
//
// Idempotent: leads that already have a demoUrl are never touched.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = { top: 20, offer: "site", dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--top") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > 500) {
        throw new Error(`--top must be an integer 1-500, got "${argv[i]}"`);
      }
      args.top = n;
    } else if (a === "--offer") {
      args.offer = String(argv[++i] || "").trim();
      if (!args.offer) throw new Error("--offer requires a value");
    } else if (a === "--dry-run") {
      args.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function kebab(input) {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/['’]/g, "") // drop apostrophes (don't split "Jet's" → jet-s)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Unique slug from name (+city, +counter as needed). */
function uniqueSlug(name, city, taken) {
  const base = kebab(name) || "local-business";
  const candidates = [base];
  if (city) candidates.push(kebab(`${name} ${city}`));
  for (const c of candidates) {
    if (c && !taken.has(c)) return c;
  }
  for (let i = 2; i < 100; i++) {
    const c = `${candidates[candidates.length - 1]}-${i}`;
    if (!taken.has(c)) return c;
  }
  throw new Error(`Could not generate unique slug for "${name}"`);
}

const { top, offer, dryRun } = parseArgs(process.argv);

// Existing slugs across ALL leads — dedupe target.
const existing = await prisma.growthLead.findMany({
  where: { demoUrl: { not: null } },
  select: { demoUrl: true },
});
const taken = new Set(
  existing
    .map((l) => l.demoUrl || "")
    .filter((u) => u.startsWith("/demo/"))
    .map((u) => u.slice("/demo/".length))
);

// Top prospects still waiting on a demo. demoUrl=null makes this idempotent.
const leads = await prisma.growthLead.findMany({
  where: { offer, stage: "scraped", demoUrl: null },
  orderBy: [{ score: "desc" }, { reviews: "desc" }, { createdAt: "asc" }],
  take: top,
});

if (leads.length === 0) {
  console.log(`Nothing to do — no offer="${offer}" leads at stage=scraped without a demoUrl.`);
  await prisma.$disconnect();
  process.exit(0);
}

let built = 0;
for (const lead of leads) {
  const slug = uniqueSlug(lead.name, lead.city, taken);
  taken.add(slug);
  const demoUrl = `/demo/${slug}`;
  if (dryRun) {
    console.log(`[dry-run] ${lead.name} (${lead.city || "?"}, score ${lead.score ?? "?"}) → ${demoUrl}`);
    continue;
  }
  await prisma.growthLead.update({
    where: { id: lead.id },
    data: { demoUrl, stage: "demo_built" },
  });
  built++;
  console.log(`${lead.name} (${lead.city || "?"}, score ${lead.score ?? "?"}) → https://www.tolley.io${demoUrl}`);
}

console.log(
  dryRun
    ? `dry-run complete: ${leads.length} leads would get demos`
    : `done: ${built} demos assigned (offer=${offer}, stage scraped → demo_built)`
);
await prisma.$disconnect();
