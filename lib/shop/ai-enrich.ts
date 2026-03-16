/**
 * AI enrichment via local Qwen3.5-35B on vLLM.
 * Text-only analysis (Qwen runs --language-model-only).
 */

const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";

export interface AiSuggestions {
  suggestedTitle: string;
  suggestedCategory: string;
  suggestedPrice: { low: number; mid: number; high: number };
  tags: string[];
  conditionKeywords: string[];
  confidence: number;
}

export async function enrichProduct(input: {
  title: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  condition?: string | null;
}): Promise<AiSuggestions> {
  const prompt = `You are a retail arbitrage expert. Analyze this product and provide suggestions for optimal listing.

Product: ${input.title}
${input.description ? `Description: ${input.description}` : ""}
${input.category ? `Current category: ${input.category}` : ""}
${input.brand ? `Brand: ${input.brand}` : ""}
${input.condition ? `Condition: ${input.condition}` : ""}

Return JSON only (no markdown, no explanation):
{
  "suggestedTitle": "eBay-optimized title (max 80 chars, include brand, key features, condition)",
  "suggestedCategory": "best category from: Furniture, Electronics, Clothing, Home, Kitchen, Kids, Sports, Tools, Automotive, Toys, Books, Other",
  "suggestedPrice": { "low": 0, "mid": 0, "high": 0 },
  "tags": ["tag1", "tag2", "tag3"],
  "conditionKeywords": ["keyword1", "keyword2"],
  "confidence": 0.0
}`;

  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "Qwen/Qwen3.5-35B-A3B-FP8",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`AI service returned ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI returned non-JSON response");
  }

  return JSON.parse(jsonMatch[0]) as AiSuggestions;
}
