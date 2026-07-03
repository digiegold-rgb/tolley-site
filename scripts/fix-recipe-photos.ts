/**
 * scripts/fix-recipe-photos.ts
 *
 * Replaces missing/broken/AI-generated recipe photos with real food photos
 * from TheMealDB (free, no API key, public food photo database).
 *
 * Strategy:
 *   1. Find all recipes with NULL imageUrl OR vercel-storage.com (AI-gen) URLs
 *   2. For each, try TheMealDB:
 *        a. Search by full title
 *        b. Search by simplified title (strip "Classic", "Homemade", etc.)
 *        c. Filter by category (mapped from cuisine/keywords)
 *        d. Final fallback: random meal from a relevant category
 *   3. Update DB with the new URL
 *   4. Verify each new URL with a HEAD request before saving
 *
 * Run with: npx tsx scripts/fix-recipe-photos.ts [--dry-run] [--include-ai]
 *   --dry-run     show what would change without writing
 *   --include-ai  also replace existing AI-generated Vercel Blob URLs
 *                 (default: only fix NULL and broken URLs)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}
loadDotenv(resolve(process.cwd(), ".env.local"));
loadDotenv(resolve(process.cwd(), ".env"));

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const INCLUDE_AI = process.argv.includes("--include-ai");

// ─────────────────────────────────────────────────────────────────────────────
// TheMealDB helpers
// ─────────────────────────────────────────────────────────────────────────────

const MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1";

interface MealDBMeal {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strCategory?: string;
  strArea?: string;
}

async function searchByName(name: string): Promise<string | null> {
  try {
    const res = await fetch(`${MEALDB_BASE}/search.php?s=${encodeURIComponent(name)}`);
    const data = await res.json();
    return data.meals?.[0]?.strMealThumb || null;
  } catch {
    return null;
  }
}

const categoryCache = new Map<string, MealDBMeal[]>();
async function filterByCategory(category: string): Promise<MealDBMeal[]> {
  if (categoryCache.has(category)) return categoryCache.get(category)!;
  try {
    const res = await fetch(`${MEALDB_BASE}/filter.php?c=${encodeURIComponent(category)}`);
    const data = await res.json();
    const meals = data.meals || [];
    categoryCache.set(category, meals);
    return meals;
  } catch {
    return [];
  }
}

// Pick a random meal from one of these categories, deterministic per recipe id.
async function pickFromCategories(
  categories: string[],
  recipeId: string
): Promise<string | null> {
  for (const cat of categories) {
    const meals = await filterByCategory(cat);
    if (meals.length > 0) {
      // Deterministic pick based on recipeId hash
      let hash = 0;
      for (const c of recipeId) hash = (hash * 31 + c.charCodeAt(0)) | 0;
      const idx = Math.abs(hash) % meals.length;
      return meals[idx].strMealThumb;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Title simplification + categorization
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_PREFIXES = [
  /\b(classic|old[- ]fashioned|homemade|sheet pan|crockpot|slow cooker|one[- ]pot|easy|quick|simple|grandma's?|grandma|the best|family favorite|creamy|spicy|loaded)\b/gi,
  /\bwith [a-z, ]+$/i,
  /\band [a-z ]+$/i,
];

function simplify(title: string): string[] {
  const variants = new Set<string>();
  variants.add(title);

  let simplified = title;
  for (const re of STRIP_PREFIXES) {
    simplified = simplified.replace(re, "").trim();
  }
  simplified = simplified.replace(/\s+/g, " ").trim();
  if (simplified && simplified !== title) variants.add(simplified);

  // Just the main noun (often the last 1-2 words)
  const words = simplified.split(/\s+/);
  if (words.length >= 2) {
    variants.add(words.slice(-2).join(" "));
    variants.add(words.slice(-1).join(" "));
  }

  return Array.from(variants);
}

// Map a recipe to MealDB category candidates
function categoriesFor(title: string, cuisine: string | null): string[] {
  const t = title.toLowerCase();
  const cats: string[] = [];

  // Specific dish keywords
  if (t.includes("pasta") || t.includes("spaghetti") || t.includes("lasagna") || t.includes("alfredo") || t.includes("fagioli")) cats.push("Pasta");
  if (t.includes("seafood") || t.includes("shrimp") || t.includes("salmon") || t.includes("fish") || t.includes("tuna")) cats.push("Seafood");
  if (t.includes("pork") || t.includes("bacon") || t.includes("ham")) cats.push("Pork");
  if (t.includes("beef") || t.includes("steak") || t.includes("burger") || t.includes("meatloaf") || t.includes("meatball")) cats.push("Beef");
  if (t.includes("chicken") || t.includes("poultry") || t.includes("turkey")) cats.push("Chicken");
  if (t.includes("breakfast") || t.includes("pancake") || t.includes("egg") || t.includes("muffin") || t.includes("biscuit") || t.includes("burrito") || t.includes("french toast")) cats.push("Breakfast");
  if (t.includes("dessert") || t.includes("cake") || t.includes("cookie") || t.includes("pie") || t.includes("brownie")) cats.push("Dessert");
  if (t.includes("vegan")) cats.push("Vegan");
  if (t.includes("vegetarian") || t.includes("veggie") || t.includes("salad") || t.includes("caprese") || t.includes("hummus")) cats.push("Vegetarian");

  // Cuisine-based fallback
  const c = (cuisine || "").toLowerCase();
  if (c.includes("italian")) cats.push("Pasta", "Vegetarian");
  if (c.includes("chinese") || c.includes("asian") || c.includes("thai") || c.includes("japanese")) cats.push("Chicken", "Beef", "Seafood");
  if (c.includes("mexican")) cats.push("Beef", "Chicken");
  if (c.includes("american") || c.includes("southern")) cats.push("Beef", "Chicken", "Pork");
  if (c.includes("mediterranean") || c.includes("greek")) cats.push("Chicken", "Vegetarian", "Seafood");

  // Final fallback so we always have *something*
  if (cats.length === 0) cats.push("Miscellaneous", "Chicken", "Beef");

  // Dedupe preserving order
  return Array.from(new Set(cats));
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo lookup pipeline
// ─────────────────────────────────────────────────────────────────────────────

async function findPhoto(
  recipeId: string,
  title: string,
  cuisine: string | null
): Promise<{ url: string; via: string } | null> {
  // 1. Try each title variant against TheMealDB search
  for (const variant of simplify(title)) {
    const url = await searchByName(variant);
    if (url) {
      return { url, via: `mealdb:search:${variant}` };
    }
  }

  // 2. Fall back to category filter
  const cats = categoriesFor(title, cuisine);
  const url = await pickFromCategories(cats, recipeId);
  if (url) {
    return { url, via: `mealdb:category:${cats.join("|")}` };
  }

  return null;
}

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🍽️  Recipe photo fixer  ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}`);
  console.log(`   include-ai: ${INCLUDE_AI ? "yes (replaces AI-gen photos too)" : "no (only fixes NULL/broken)"}\n`);

  // Load all recipes
  const all = await prisma.foodRecipe.findMany({
    select: { id: true, title: true, slug: true, imageUrl: true, cuisine: true },
    orderBy: { title: "asc" },
  });

  // Identify recipes needing fixes
  const needsFix: typeof all = [];
  for (const r of all) {
    if (!r.imageUrl) {
      needsFix.push(r);
      continue;
    }
    if (INCLUDE_AI && r.imageUrl.includes("vercel-storage.com")) {
      needsFix.push(r);
      continue;
    }
    // For non-AI URLs, check if they're broken
    if (!r.imageUrl.includes("vercel-storage.com")) {
      const ok = await verifyUrl(r.imageUrl);
      if (!ok) {
        needsFix.push(r);
        console.log(`   broken: ${r.title}`);
      }
    }
  }

  console.log(`\n📋 ${needsFix.length} recipe${needsFix.length === 1 ? "" : "s"} need a new photo:\n`);
  for (const r of needsFix) console.log(`   • ${r.title}`);
  console.log("");

  if (needsFix.length === 0) {
    console.log("✨ Nothing to fix.");
    await prisma.$disconnect();
    return;
  }

  // Find a photo for each
  let fixed = 0;
  let failed = 0;
  for (const r of needsFix) {
    const result = await findPhoto(r.id, r.title, r.cuisine);
    if (!result) {
      console.log(`❌ ${r.title} — no photo found`);
      failed += 1;
      continue;
    }

    const ok = await verifyUrl(result.url);
    if (!ok) {
      console.log(`❌ ${r.title} — found URL but it 404'd: ${result.url}`);
      failed += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`📝 ${r.title} → ${result.url}  [${result.via}]`);
    } else {
      await prisma.foodRecipe.update({
        where: { id: r.id },
        data: { imageUrl: result.url },
      });
      console.log(`✅ ${r.title} → ${result.url.split("/").pop()}  [${result.via}]`);
    }
    fixed += 1;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Fixed:  ${fixed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Mode:   ${DRY_RUN ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err);
  process.exit(1);
});
