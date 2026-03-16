import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const prompt = `You are a retail arbitrage expert. Analyze this product and provide suggestions.

Product: ${product.title}
${product.description ? `Description: ${product.description}` : ""}
${product.category ? `Current category: ${product.category}` : ""}
${product.brand ? `Brand: ${product.brand}` : ""}
${product.condition ? `Condition: ${product.condition}` : ""}

Return JSON only (no markdown):
{
  "suggestedTitle": "eBay-optimized title (max 80 chars)",
  "suggestedCategory": "best category from: Furniture, Electronics, Clothing, Home, Kitchen, Kids, Sports, Tools, Automotive, Toys, Books, Other",
  "suggestedPrice": { "low": 0, "mid": 0, "high": 0 },
  "tags": ["tag1", "tag2"],
  "conditionKeywords": ["keyword1"],
  "confidence": 0.0
}`;

  try {
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
      return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    // Save suggestions to product
    await prisma.product.update({
      where: { id },
      data: {
        aiSuggestedTitle: suggestions.suggestedTitle || null,
        aiSuggestedPrice: suggestions.suggestedPrice?.mid || null,
        aiSuggestedCategory: suggestions.suggestedCategory || null,
        aiConfidence: suggestions.confidence || null,
      },
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
