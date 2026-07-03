/**
 * AI enrichment via local Qwen3.5-35B on vLLM.
 * Text-only analysis (Qwen runs --language-model-only).
 */

import { chatCompletion } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

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

/**
 * Generate a short, friendly resale description from just a title (and
 * optionally a category). Used by the FB sold-items backfill — for those rows
 * we don't have human-written descriptions, so we synthesize one in Ruthann's
 * voice. Hard-fails to title-only fallback so the caller never has to handle
 * an exception.
 *
 * Routing: goes through `chatCompletion` which reads LLM_API_URL/LLM_API_KEY/
 * LLM_MODEL env vars. Per `feedback_dgx_creator_mode_permanent.md`, that
 * should be Kimi K2 via LiteLLM in production.
 */
export async function generateDescriptionFromTitle(
  title: string,
  category: string | null,
  _opts?: { photoUrl?: string | null }
): Promise<{ description: string; modelTag: string }> {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { description: cleanTitle || "Item for sale", modelTag: "fallback-title" };
  }

  // If LLM env isn't configured, don't even attempt — just fall back.
  if (!process.env.LLM_API_URL) {
    return { description: cleanTitle, modelTag: "fallback-title" };
  }

  try {
    const response = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are Ruthann, a casual reseller in Independence MO. You write friendly, honest 60-90 word resale listings. No invented specs, no fake measurements. If unsure of condition, say 'good used'.",
        },
        {
          role: "user",
          content: `Title: ${cleanTitle}\nCategory: ${category || "unspecified"}\nWrite a 60-90 word friendly resale description.`,
        },
      ],
      {
        maxTokens: 220,
        temperature: 0.6,
        timeoutMs: 8_000,
        type: "shop-backfill-description",
        route: "lib/shop/ai-enrich.generateDescriptionFromTitle",
      }
    );

    const text = (response.text || "").trim();
    if (!text || text.length < 20) {
      return { description: cleanTitle, modelTag: "fallback-title" };
    }
    return { description: text, modelTag: response.model || "kimi" };
  } catch {
    return { description: cleanTitle, modelTag: "fallback-title" };
  }
}

/**
 * Walk the products in a backfill batch and fill in their descriptions via
 * the LLM. Designed to be called from `after()` in fb-sync as well as a Vercel
 * cron safety net, so it must be idempotent and never throw.
 *
 * Concurrency: products are split into chunks of `batchSize` (default 10);
 * within a chunk we go sequentially (rate-limit friendly), but chunks
 * themselves are processed back-to-back. Total work is capped at `max`
 * (default 200) to keep any single invocation within Vercel's function
 * timeout budget.
 */
export async function enrichBackfilledProducts(
  batchId: string,
  opts: { batchSize?: number; max?: number } = {}
): Promise<{ enriched: number; failed: number }> {
  const batchSize = Math.max(1, opts.batchSize ?? 10);
  const max = Math.max(0, opts.max ?? 200);
  if (max === 0) return { enriched: 0, failed: 0 };

  const products = await prisma.product.findMany({
    where: {
      fbBackfillBatchId: batchId,
      descriptionSource: null,
    },
    select: {
      id: true,
      title: true,
      category: true,
      imageUrls: true,
    },
    take: max,
  });

  if (products.length === 0) return { enriched: 0, failed: 0 };

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += batchSize) {
    const chunk = products.slice(i, i + batchSize);
    for (const p of chunk) {
      try {
        const photoUrl = Array.isArray(p.imageUrls) && p.imageUrls.length > 0
          ? p.imageUrls[0]
          : null;
        const result = await generateDescriptionFromTitle(p.title, p.category, {
          photoUrl,
        });
        const sourceTag = result.modelTag === "fallback-title" ? "fallback" : "kimi";
        await prisma.product.update({
          where: { id: p.id },
          data: {
            description: result.description,
            descriptionSource: sourceTag,
          },
        });
        enriched++;
      } catch (err) {
        failed++;
        console.error(
          `[enrich-backfill] product=${p.id} batch=${batchId} failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  return { enriched, failed };
}
