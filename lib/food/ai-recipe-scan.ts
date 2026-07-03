import { visionJSON } from "./ai-client";

export interface ScannedRecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export interface ScannedRecipeInstruction {
  step: number;
  text: string;
  duration?: number;
}

export interface ScannedRecipe {
  title: string;
  description?: string;
  cuisine?: string;
  mealType?: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags?: string[];
  source?: string;
  ingredients: ScannedRecipeIngredient[];
  instructions: ScannedRecipeInstruction[];
}

const RECIPE_PROMPT = `You are an expert recipe OCR. Read the recipe shown in the image(s) — which may be a handwritten card, cookbook page, magazine clipping, printed page, or phone screenshot — and extract it into structured JSON.

Return ONLY valid JSON with this exact shape:
{
  "title": "Recipe Title",
  "description": "Optional one-line description if present, else omit",
  "cuisine": "Italian | Mexican | American | Asian | Indian | Mediterranean | Japanese | Thai | Chinese | French | (best guess)",
  "mealType": ["breakfast" | "lunch" | "dinner" | "snack" | "dessert"],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "tags": ["kid-friendly", "quick", "comfort", "healthy", "budget", "one-pot", "meal-prep", "slow-cooker"],
  "source": "Cookbook name, magazine, URL, or handwritten note author if visible",
  "ingredients": [
    {"name": "all-purpose flour", "quantity": "2", "unit": "cups", "notes": "sifted"}
  ],
  "instructions": [
    {"step": 1, "text": "Preheat oven to 350°F.", "duration": 5}
  ]
}

RULES:
- Always include title, ingredients, and instructions. Everything else is optional — OMIT keys you can't determine rather than guessing.
- Split ingredient lines into { name, quantity, unit, notes }. Strip quantities/units from the name. Leave unit "" if none (e.g., "2 eggs" → qty "2", unit "", name "eggs").
- Convert fractions like "1/2" to "1/2" (keep as string — do NOT use decimals, users want to see fractions).
- For instructions, split into numbered steps even if the source writes them as a paragraph. Keep each step concise but complete.
- duration is minutes (number), only when clearly stated ("bake 25 min").
- prepTime/cookTime in minutes. If only a total time is given, put it all in cookTime.
- tags only from the allowed list above; pick at most 3 that genuinely fit.
- If multiple recipes appear, extract only the most prominent one.
- If the image is NOT a recipe (e.g. grocery receipt, random text), return {"title": "", "ingredients": [], "instructions": []} so the caller can detect it.`;

/**
 * Scan a physical or photographed recipe (cookbook page, index card, magazine,
 * printout, screenshot) via Gemini vision and return it as structured JSON
 * ready for the /food/recipes/new form.
 *
 * Uses Gemini because Qwen3.5-35B-A3B-FP8 is text-only
 * (per feedback_vllm_qwen_text_only).
 */
export async function scanRecipe(
  imageBase64: string,
  mimeType: string
): Promise<ScannedRecipe> {
  return visionJSON<ScannedRecipe>({
    task: "scan-recipe",
    prompt: RECIPE_PROMPT,
    images: [{ base64: imageBase64, mimeType }],
    temperature: 0.2,
    maxTokens: 4000,
    timeoutMs: 90000,
  });
}
