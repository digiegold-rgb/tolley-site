import { visionJSON } from "./ai-client";

export interface RecognizedGroceryItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  brand?: string;
}

const GROCERY_PROMPT = `Identify all grocery/food items in this image. For each item, estimate the quantity and appropriate unit (e.g., "1 bunch", "2 lb", "1 loaf").

Categorize each item into one of: produce, dairy, meat, bakery, frozen, canned, condiments, snacks, beverages, baking, spices, grains, deli, household.

If you can identify a brand, include it.

Return ONLY a valid JSON array: [{"name": "...", "quantity": 1, "unit": "each", "category": "produce", "brand": "optional"}]`;

/**
 * Recognize grocery items from a photo. Uses Gemini 2.5 Flash because Qwen3.5-35B-A3B-FP8
 * is text-only and hangs on image_url requests (per feedback_vllm_qwen_text_only).
 */
export async function recognizeGroceries(
  imageBase64: string,
  mimeType: string
): Promise<RecognizedGroceryItem[]> {
  return visionJSON<RecognizedGroceryItem[]>({
    task: "recognize-groceries",
    prompt: GROCERY_PROMPT,
    images: [{ base64: imageBase64, mimeType }],
    temperature: 0.3,
    maxTokens: 2000,
  });
}
