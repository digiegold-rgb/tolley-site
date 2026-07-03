/**
 * lib/food/yummly-normalizer.ts
 *
 * Takes raw candidate recipes from an import parser and runs them through
 * the unified AI client (Qwen primary, Gemini fallback) in small batches to
 * fill in missing metadata: cuisine, meal type, tags, nutrition estimates,
 * structured ingredient/instruction arrays matching our FoodRecipe schema.
 */

import { chatJSON } from "./ai-client";
import type { RawRecipeCandidate } from "./yummly-parser";

export interface NormalizedRecipe {
  title: string;
  slug: string;
  description: string;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    notes?: string;
  }>;
  instructions: Array<{ step: number; text: string; duration?: string }>;
  cuisine: string;
  mealType: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  tags: string[];
  source?: string;
  imageUrl?: string;
}

const BATCH_SIZE = 4;

/**
 * Normalize an array of raw recipes into the FoodRecipe shape. Processes in
 * batches of 4 to keep AI request size bounded. Fallible per-recipe: if a
 * batch fails to parse, we try one-at-a-time recovery so a single bad recipe
 * doesn't kill an otherwise successful import.
 */
export async function normalizeRecipeBatch(
  raw: RawRecipeCandidate[]
): Promise<{ normalized: NormalizedRecipe[]; failed: number }> {
  if (raw.length === 0) return { normalized: [], failed: 0 };

  const normalized: NormalizedRecipe[] = [];
  let failed = 0;

  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const batch = raw.slice(i, i + BATCH_SIZE);
    try {
      const result = await normalizeSingleBatch(batch);
      normalized.push(...result);
    } catch (err) {
      console.warn(
        `[yummly-normalizer] batch ${i / BATCH_SIZE} failed, retrying 1-by-1`,
        err
      );
      // Recovery: try each recipe individually
      for (const candidate of batch) {
        try {
          const singles = await normalizeSingleBatch([candidate]);
          normalized.push(...singles);
        } catch (innerErr) {
          failed += 1;
          console.warn(
            `[yummly-normalizer] recipe skipped: ${candidate.title}`,
            innerErr
          );
        }
      }
    }
  }

  return { normalized, failed };
}

async function normalizeSingleBatch(
  batch: RawRecipeCandidate[]
): Promise<NormalizedRecipe[]> {
  const systemPrompt = `You are a recipe normalization assistant. You will receive raw recipes imported from an external app (Yummly, PlateJoy, or similar) with inconsistent formatting. Your job is to return clean, structured recipes matching this exact JSON schema:

{
  "recipes": [{
    "title": "Recipe Title",
    "slug": "recipe-title-kebab-case",
    "description": "1-2 sentence appetizing description",
    "ingredients": [{"name": "chicken breast", "quantity": 1, "unit": "lb", "notes": "boneless"}],
    "instructions": [{"step": 1, "text": "Preheat oven to 400F", "duration": "5 min"}],
    "cuisine": "Italian",
    "mealType": ["dinner"],
    "prepTime": 15,
    "cookTime": 30,
    "servings": 4,
    "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0},
    "tags": ["quick", "family-friendly"]
  }]
}

Rules:
- Parse free-text ingredient strings like "2 cups flour, sifted" into {name: "flour", quantity: 2, unit: "cup", notes: "sifted"}
- If quantity is missing, use 1. If unit is missing, use "each".
- Split run-on instruction text into numbered steps when possible
- Estimate prepTime and cookTime in MINUTES from any available context (if source data had ISO durations, convert)
- If cuisine is not specified, infer from ingredients (tortillas → Mexican, soy sauce → Asian, parmesan → Italian)
- mealType is an array from: breakfast, lunch, dinner, snack, dessert, appetizer
- Estimate nutrition per serving (best effort — set reasonable round numbers)
- Generate 2-4 tags: e.g., vegetarian, quick, kid-friendly, gluten-free, one-pot, make-ahead, slow-cooker
- If description is empty, write a short appetizing one based on the ingredients
- slug must be lowercase kebab-case, derived from the title`;

  const recipesForAi = batch.map((r, idx) => ({
    index: idx,
    title: r.title,
    description: r.description || "",
    ingredients: r.ingredients,
    instructions: r.instructions,
    cuisine: r.cuisine || "",
    prepTime: r.prepTime || null,
    cookTime: r.cookTime || null,
    servings: r.servings || null,
    tags: r.tags || [],
  }));

  const userPrompt = `Normalize these ${batch.length} recipe${batch.length === 1 ? "" : "s"} into clean JSON. Return an object with a "recipes" array in the exact order provided:\n\n${JSON.stringify(recipesForAi, null, 2)}`;

  const response = await chatJSON<{ recipes: NormalizedRecipe[] }>({
    task: "yummly-normalize",
    system: systemPrompt,
    user: userPrompt,
    temperature: 0.3,
    maxTokens: 6000,
    timeoutMs: 120000,
  });

  if (!response.recipes || !Array.isArray(response.recipes)) {
    throw new Error("AI response missing recipes array");
  }

  // Preserve source and imageUrl from the raw candidate (AI doesn't see them).
  return response.recipes.map((normalized, idx) => {
    const source = batch[idx]?.source;
    const imageUrl = batch[idx]?.imageUrl;
    return {
      ...normalized,
      slug: normalized.slug || slugify(normalized.title),
      source,
      imageUrl,
    };
  });
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
