/**
 * lib/food/yummly-parser.ts
 *
 * Parses Yummly / PlateJoy / generic JSON recipe exports out of a .zip or
 * single JSON payload into raw candidate recipes. Format-tolerant by design:
 * we don't know exactly what every user's export looks like, so we accept
 * everything that looks vaguely recipe-shaped and let the AI normalizer
 * clean it up downstream.
 */

import JSZip from "jszip";

export interface RawRecipeCandidate {
  title: string;
  ingredients: string[];
  instructions: string[];
  description?: string;
  source?: string;
  imageUrl?: string;
  cuisine?: string;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  tags?: string[];
}

/** Parse a .zip buffer and return all recipe candidates found inside. */
export async function parseYummlyZip(
  buffer: Buffer
): Promise<RawRecipeCandidate[]> {
  const zip = await JSZip.loadAsync(buffer);
  const candidates: RawRecipeCandidate[] = [];

  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!filename.toLowerCase().endsWith(".json")) continue;

    try {
      const text = await entry.async("string");
      const parsed = JSON.parse(text);
      candidates.push(...extractRecipesFromJson(parsed));
    } catch (err) {
      console.warn(`[yummly-parser] skipped ${filename}:`, err);
    }
  }

  return dedupeByTitle(candidates);
}

/** Parse a raw JSON payload (no zip wrapper) into recipe candidates. */
export function parseRawJson(raw: unknown): RawRecipeCandidate[] {
  return dedupeByTitle(extractRecipesFromJson(raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractRecipesFromJson(input: unknown): RawRecipeCandidate[] {
  if (!input) return [];

  // Array of recipes
  if (Array.isArray(input)) {
    return input
      .map(normalizeOne)
      .filter((r): r is RawRecipeCandidate => r !== null);
  }

  // Object with a `recipes` / `collection` / `items` array
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    for (const key of ["recipes", "collection", "items", "savedRecipes", "data"]) {
      const val = obj[key];
      if (Array.isArray(val)) {
        return val
          .map(normalizeOne)
          .filter((r): r is RawRecipeCandidate => r !== null);
      }
    }
    // Single-recipe object
    const single = normalizeOne(input);
    return single ? [single] : [];
  }

  return [];
}

function normalizeOne(raw: unknown): RawRecipeCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const title = pickString(r, ["name", "title", "recipeName", "displayName"]);
  if (!title) return null;

  const ingredients = pickStringArray(r, [
    "ingredients",
    "ingredientLines",
    "ingredient_lines",
    "recipeIngredient",
  ]);

  const instructions = pickStringArray(r, [
    "instructions",
    "directions",
    "steps",
    "recipeInstructions",
    "method",
  ]);

  // Recipes with no ingredients AND no instructions are almost certainly not recipes.
  if (ingredients.length === 0 && instructions.length === 0) return null;

  return {
    title: String(title).slice(0, 200),
    ingredients: ingredients.slice(0, 100),
    instructions: instructions.slice(0, 80),
    description: pickString(r, ["description", "summary", "desc"]) || undefined,
    source: pickString(r, ["source", "sourceUrl", "url", "siteUrl"]) || undefined,
    imageUrl:
      pickString(r, ["imageUrl", "image", "photo", "photoUrl", "thumbnail"]) ||
      undefined,
    cuisine: pickString(r, ["cuisine", "cuisineType"]) || undefined,
    prepTime: pickNumber(r, ["prepTime", "prepTimeMinutes", "prep_time"]),
    cookTime: pickNumber(r, ["cookTime", "cookTimeMinutes", "cook_time"]),
    servings: pickNumber(r, ["servings", "yield", "numberOfServings"]),
    tags: pickStringArray(r, ["tags", "categories", "keywords"]) || undefined,
  };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function pickNumber(
  obj: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string") {
      // Handle ISO 8601 durations ("PT15M") or plain numbers in strings
      const iso = val.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (iso) {
        const hours = parseInt(iso[1] || "0", 10);
        const minutes = parseInt(iso[2] || "0", 10);
        return hours * 60 + minutes;
      }
      const plain = parseFloat(val);
      if (Number.isFinite(plain)) return plain;
    }
  }
  return null;
}

function pickStringArray(
  obj: Record<string, unknown>,
  keys: string[]
): string[] {
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) {
      return val
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (typeof item === "object" && item !== null) {
            const inner = item as Record<string, unknown>;
            const text =
              inner.text ||
              inner.name ||
              inner.instruction ||
              inner.step ||
              inner.ingredient;
            return typeof text === "string" ? text.trim() : "";
          }
          return "";
        })
        .filter((s) => s.length > 0);
    }
  }
  return [];
}

function dedupeByTitle(candidates: RawRecipeCandidate[]): RawRecipeCandidate[] {
  const seen = new Set<string>();
  const result: RawRecipeCandidate[] = [];
  for (const c of candidates) {
    const key = c.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}
