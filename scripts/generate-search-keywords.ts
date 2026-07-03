/**
 * Generate Amazon search keywords for shop products that lack them.
 *
 * Why: FB-Marketplace-style titles ("Bamboo Wire Rack Shelving Covers")
 * produce poor Amazon search results. The /api/shop/amazon/search/[id]
 * redirect prefers `searchKeywords` over `title` — if we have curated 3–6
 * generic terms, the user lands on relevant results and the 24h affiliate
 * cookie has a real chance of converting.
 *
 * Run:
 *   cd ~/tolley-site && npx tsx scripts/generate-search-keywords.ts
 *
 * Idempotent — only touches rows where searchKeywords IS NULL.
 *
 * Override:
 *   LIMIT=10        only process 10 products
 *   FORCE=1         re-generate even if searchKeywords already set
 *   MODEL=gemini-2.5-flash
 *   BATCH=5         products per Gemini call
 */
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

// Standalone scripts don't get Next.js's automatic .env.local loading.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const prisma = new PrismaClient();

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error("Missing GEMINI_API_KEY in env (.env.local).");
  process.exit(1);
}

const MODEL = process.env.MODEL || "gemini-2.5-flash";
const BATCH = parseInt(process.env.BATCH || "5", 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const FORCE = process.env.FORCE === "1";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface ProductInput {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
}

interface KeywordResult {
  id: string;
  keywords: string;
}

const SYSTEM = `You convert second-hand resale product listings into short Amazon search queries.
For each product, return 3-6 short generic shopping keywords (NO brand names, NO sizes, NO colors unless central to the item) that someone would type into Amazon to find a similar new item.
Examples:
  "Bamboo Wire Rack Shelving Covers" + Home → "bamboo shelf cover dust storage"
  "12x16 Golden Accented Picture Frames" + Home → "gold picture frame 12x16"
  "Vacuum Sealer machine" + Kitchen → "vacuum sealer food bags"
  "Carry on rolling backpack for air travel" + Other → "rolling backpack carry on travel"
Output ONLY valid JSON: an array of objects {id, keywords} with no prose, no code fences.`;

async function geminiBatch(products: ProductInput[]): Promise<KeywordResult[]> {
  const userPrompt = `Generate keywords for these ${products.length} products:\n\n${products
    .map(
      (p, i) =>
        `${i + 1}. id=${p.id}\n   title: ${p.title}\n   category: ${p.category ?? "Other"}${
          p.description ? `\n   desc: ${p.description.slice(0, 200)}` : ""
        }`
    )
    .join("\n\n")}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 }, // memory: budget=0 for clean JSON
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleaned = text.replace(/```json\s*|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as Array<{
    id: string;
    keywords: string | string[];
  }>;
  if (!Array.isArray(parsed)) throw new Error("Expected array of keyword results");
  // Gemini may return keywords as either "a b c" or ["a","b","c"]; normalize.
  return parsed.map((r) => ({
    id: r.id,
    keywords: Array.isArray(r.keywords) ? r.keywords.join(" ") : String(r.keywords ?? ""),
  }));
}

async function main() {
  const where = FORCE ? {} : { searchKeywords: null };
  const products = await prisma.product.findMany({
    where: {
      ...where,
      status: { in: ["listed", "sold", "draft"] },
    },
    select: { id: true, title: true, category: true, description: true },
    orderBy: { createdAt: "desc" },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(
    `Found ${products.length} products${FORCE ? "" : " without searchKeywords"}.`
  );
  if (products.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  let errored = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const slice = products.slice(i, i + BATCH);
    const tag = `[${i + 1}-${Math.min(i + BATCH, products.length)}/${products.length}]`;
    try {
      const results = await geminiBatch(slice);
      const byId = new Map(results.map((r) => [r.id, r.keywords?.trim() ?? ""]));
      for (const p of slice) {
        const kw = byId.get(p.id);
        if (!kw) {
          console.warn(`${tag} no keywords returned for ${p.id} (${p.title.slice(0, 40)})`);
          continue;
        }
        await prisma.product.update({
          where: { id: p.id },
          data: { searchKeywords: kw },
        });
        console.log(`${tag} ${p.title.slice(0, 50)} → "${kw}"`);
        updated++;
      }
    } catch (err) {
      console.error(
        `${tag} ERROR:`,
        err instanceof Error ? err.message : err
      );
      errored += slice.length;
    }
  }

  console.log(`\nDone. updated=${updated} errored=${errored} of ${products.length}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
