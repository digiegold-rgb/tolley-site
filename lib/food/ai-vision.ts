const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";
const MODEL = "Qwen/Qwen3.5-35B-A3B-FP8";

export interface RecognizedGroceryItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  brand?: string;
}

export async function recognizeGroceries(
  imageBase64: string,
  mimeType: string
): Promise<RecognizedGroceryItem[]> {
  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: `Identify all grocery/food items in this image. For each item, estimate the quantity and appropriate unit (e.g., "1 bunch", "2 lb", "1 loaf").

Categorize each item into one of: produce, dairy, meat, bakery, frozen, canned, condiments, snacks, beverages, baking, spices, grains, deli, household.

If you can identify a brand, include it.

Return ONLY a valid JSON array: [{"name": "...", "quantity": 1, "unit": "each", "category": "produce", "brand": "optional"}]`,
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(60000),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new Error("Failed to parse grocery items from AI response");
  }

  return JSON.parse(jsonMatch[0]) as RecognizedGroceryItem[];
}
