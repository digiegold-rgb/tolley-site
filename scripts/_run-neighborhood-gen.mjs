/**
 * One-shot neighborhood generator. Mirrors lib/neighborhoods/generator.ts
 * but runs as a Node script so it can be triggered from the CLI without
 * the shop-admin auth gate. Does the same SerpAPI google call per
 * neighborhood + persists FAQ + KG to NeighborhoodPage.
 */
import { PrismaClient } from "@prisma/client";

const KEY = process.env.SERPAPI_KEY;
if (!KEY) {
  console.error("SERPAPI_KEY missing");
  process.exit(1);
}

const SEEDS = [
  { slug: "independence-mo", name: "Independence MO", city: "Independence", state: "MO", zip: "64055", lat: 39.0911, lng: -94.4155 },
  { slug: "independence-64052", name: "Independence MO 64052", city: "Independence", state: "MO", zip: "64052", lat: 39.0769, lng: -94.4147 },
  { slug: "independence-64055", name: "Independence MO 64055", city: "Independence", state: "MO", zip: "64055", lat: 39.0467, lng: -94.3661 },
  { slug: "blue-springs-mo", name: "Blue Springs MO", city: "Blue Springs", state: "MO", zip: "64015", lat: 39.0169, lng: -94.2816 },
  { slug: "lees-summit-mo", name: "Lee's Summit MO", city: "Lee's Summit", state: "MO", zip: "64063", lat: 38.9108, lng: -94.3822 },
  { slug: "raytown-mo", name: "Raytown MO", city: "Raytown", state: "MO", zip: "64133", lat: 39.0086, lng: -94.4633 },
  { slug: "grain-valley-mo", name: "Grain Valley MO", city: "Grain Valley", state: "MO", zip: "64029", lat: 39.0152, lng: -94.1958 },
  { slug: "oak-grove-mo", name: "Oak Grove MO", city: "Oak Grove", state: "MO", zip: "64075", lat: 39.0092, lng: -94.1366 },
  { slug: "buckner-mo", name: "Buckner MO", city: "Buckner", state: "MO", zip: "64016", lat: 39.1331, lng: -94.1996 },
  { slug: "kansas-city-mo", name: "Kansas City MO", city: "Kansas City", state: "MO", zip: "64111", lat: 39.0997, lng: -94.5786 },
  { slug: "westport-kc", name: "Westport (KC MO)", city: "Kansas City", state: "MO", zip: "64111", lat: 39.0507, lng: -94.5905 },
  { slug: "brookside-kc", name: "Brookside (KC MO)", city: "Kansas City", state: "MO", zip: "64113", lat: 39.0144, lng: -94.5896 },
  { slug: "waldo-kc", name: "Waldo (KC MO)", city: "Kansas City", state: "MO", zip: "64114", lat: 38.9772, lng: -94.5905 },
  { slug: "northland-kc", name: "Northland (KC MO)", city: "Kansas City", state: "MO", zip: "64118", lat: 39.2333, lng: -94.5658 },
  { slug: "country-club-plaza", name: "Country Club Plaza (KC MO)", city: "Kansas City", state: "MO", zip: "64112", lat: 39.0411, lng: -94.5917 },
  { slug: "kansas-city-ks", name: "Kansas City KS", city: "Kansas City", state: "KS", zip: "66101", lat: 39.1141, lng: -94.6275 },
  { slug: "olathe-ks", name: "Olathe KS", city: "Olathe", state: "KS", zip: "66062", lat: 38.8814, lng: -94.7375 },
  { slug: "overland-park-ks", name: "Overland Park KS", city: "Overland Park", state: "KS", zip: "66212", lat: 38.9822, lng: -94.6708 },
  { slug: "leawood-ks", name: "Leawood KS", city: "Leawood", state: "KS", zip: "66209", lat: 38.9269, lng: -94.6169 },
  { slug: "shawnee-ks", name: "Shawnee KS", city: "Shawnee", state: "KS", zip: "66203", lat: 39.0228, lng: -94.7152 },
  { slug: "lenexa-ks", name: "Lenexa KS", city: "Lenexa", state: "KS", zip: "66215", lat: 38.9536, lng: -94.7336 },
  { slug: "mission-ks", name: "Mission KS", city: "Mission", state: "KS", zip: "66202", lat: 39.0286, lng: -94.6552 },
  { slug: "merriam-ks", name: "Merriam KS", city: "Merriam", state: "KS", zip: "66202", lat: 39.0239, lng: -94.6936 },
  { slug: "prairie-village-ks", name: "Prairie Village KS", city: "Prairie Village", state: "KS", zip: "66208", lat: 38.9914, lng: -94.6336 },
];

const db = new PrismaClient();

async function generate(seed) {
  // Upsert seed metadata
  await db.neighborhoodPage.upsert({
    where: { slug: seed.slug },
    create: seed,
    update: { name: seed.name, city: seed.city, state: seed.state, zip: seed.zip, lat: seed.lat, lng: seed.lng },
  });

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", `${seed.name} real estate`);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", KEY);

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }
  const data = await res.json();

  // FAQ from related_questions
  const faq = [];
  for (const rq of data.related_questions ?? []) {
    if (typeof rq.question !== "string" || typeof rq.snippet !== "string") continue;
    if (rq.question.length < 8 || rq.snippet.length < 20) continue;
    faq.push({ question: rq.question.trim(), answer: rq.snippet.trim().slice(0, 800) });
    if (faq.length >= 8) break;
  }

  const relatedSearches = (data.related_searches ?? [])
    .map((r) => r.query)
    .filter((q) => typeof q === "string" && q.length > 2)
    .slice(0, 12);

  let intro = null;
  const kg = data.knowledge_graph;
  if (kg?.description?.length > 60) intro = kg.description.slice(0, 600);
  else if (data.ai_overview?.text_blocks?.length) {
    const overview = data.ai_overview.text_blocks
      .map((b) => b.snippet ?? "")
      .filter(Boolean)
      .join(" ")
      .trim();
    if (overview.length > 60) intro = overview.slice(0, 600);
  }

  await db.neighborhoodPage.update({
    where: { slug: seed.slug },
    data: {
      intro,
      faqJson: faq,
      relatedSearches,
      knowledgeGraphJson: kg ? { title: kg.title ?? null, type: kg.type ?? null } : null,
      generatedAt: new Date(),
      published: faq.length >= 3,
      serpapiQueriesUsed: { increment: 1 },
    },
  });

  // Telemetry
  await db.serpapiQuery.create({
    data: {
      integration: "neighborhood-gen",
      engine: "google",
      query: `${seed.name} real estate`,
      success: true,
      costUnits: 1,
      status: 200,
    },
  }).catch(() => {});

  return { ok: true, faqCount: faq.length, hasIntro: !!intro };
}

async function main() {
  let ok = 0, errors = 0, totalFaq = 0, published = 0;
  for (const seed of SEEDS) {
    try {
      const r = await generate(seed);
      if (r.ok) {
        ok += 1;
        totalFaq += r.faqCount;
        if (r.faqCount >= 3) published += 1;
        console.log(`  ✓ ${seed.slug.padEnd(28)} faq=${r.faqCount} ${r.hasIntro ? "intro✓" : ""}`);
      } else {
        errors += 1;
        console.log(`  ✗ ${seed.slug}: ${r.error}`);
      }
    } catch (err) {
      errors += 1;
      console.error(`  ✗ ${seed.slug}: ${err.message}`);
    }
  }
  console.log(`\nGenerated ${ok}/${SEEDS.length} (${published} published, ${totalFaq} total FAQs, ${errors} errors)`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
