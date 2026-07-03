/**
 * Multi-image product vision analyzer via Gemini 2.5 Flash.
 *
 * Fetches N image URLs (typically Vercel Blob), base64-encodes them, and
 * sends all images in a single Gemini request along with a product-identification
 * prompt. Returns a typed ProductVisionResult.
 *
 * Gemini 2.5 Flash was chosen over local Qwen vLLM because Qwen3.5-35B-A3B-FP8
 * is a text-only MoE model (vision requests hang). Gemini's free tier supports
 * vision understanding with generous quotas.
 */

import { SHOP_CATEGORIES, type ShopCategory } from "@/lib/shop";

const GEMINI_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type ProductCondition = "new" | "like_new" | "good" | "fair" | "poor";

/**
 * eBay item-specifics ("aspects"). Keys match eBay's standard aspect names
 * for general-purpose categories so the same map can be sent to the Sell
 * Inventory API verbatim. Most are optional — only filled when visible.
 */
export type EbayAspects = Partial<{
  Brand: string;
  Color: string;
  Size: string;
  Material: string;
  Type: string;
  Style: string;
  Department: string;
  "Country/Region of Manufacture": string;
  MPN: string;
  Model: string;
}>;

export interface ProductVisionResult {
  title: string;
  description: string;
  category: ShopCategory;
  condition: ProductCondition;
  suggestedPriceLow: number;
  suggestedPriceMid: number;
  suggestedPriceHigh: number;
  confidence: number;
  identifyingDetails: string[];
  aspects: EbayAspects;
}

const CONDITIONS: ProductCondition[] = ["new", "like_new", "good", "fair", "poor"];

const PROMPT = `You are helping catalog a secondhand item for cross-posting to Facebook Marketplace AND eBay from Independence, Missouri (Kansas City metro).

I am showing you photos of the SAME ITEM from different angles. Examine every photo carefully.

Identify:
- What the product is (brand, model, size, material when visible)
- Condition based on visible wear, scratches, stains, damage, or packaging
- A fair resale price range for the Kansas City metro area
- eBay item specifics ("aspects") that buyers filter on

Return ONLY a single JSON object, no prose, no code fences, no markdown:
{
  "title": "<60 chars max, buyer-searchable, brand + item + key detail>",
  "description": "<2-4 short honest sentences, mention visible details>",
  "category": "<one of: Furniture, Electronics, Clothing, Home, Kitchen, Kids, Sports, Tools, Automotive, Toys, Books, Other>",
  "condition": "<one of: new, like_new, good, fair, poor>",
  "suggested_price_low": <integer USD, conservative>,
  "suggested_price_mid": <integer USD, realistic>,
  "suggested_price_high": <integer USD, optimistic>,
  "confidence": <0.0-1.0>,
  "identifying_details": ["brand: X", "model: Y", "size: Z"],
  "aspects": {
    "Brand": "<brand name if visible>",
    "Color": "<primary color>",
    "Size": "<size, dimension, or capacity if visible>",
    "Material": "<material if identifiable>",
    "Type": "<product type, e.g., 'T-Shirt', 'End Table', 'Drill'>",
    "Style": "<style if applicable>",
    "Department": "<Men, Women, Unisex Adults, Kids, Baby, etc. — only for clothing/shoes>",
    "Country/Region of Manufacture": "<if visible on tag, otherwise omit>",
    "MPN": "<manufacturer part number if printed on item>",
    "Model": "<model name/number if visible>"
  }
}

Rules:
- If you cannot identify the item, set confidence < 0.4 and use a generic title.
- Prices should reflect USED condition unless the item is clearly sealed/new.
- Never exceed $500 for suggested_price_high unless you recognize a luxury brand or model.
- Description should NOT mention payment, pickup, or shipping — those are appended separately.
- Title should NOT include the price or condition keywords like "USED" in all caps.
- For aspects: ONLY include keys you can actually determine from the photos. OMIT keys you don't know — do not guess. Empty/unknown values must be omitted entirely, not set to "unknown" or "N/A".`;

async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: buf.toString("base64"), mimeType: contentType };
}

function normalizeCategory(raw: unknown): ShopCategory {
  if (typeof raw !== "string") return "Other";
  const match = SHOP_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.trim().toLowerCase()
  );
  return match ?? "Other";
}

function normalizeCondition(raw: unknown): ProductCondition {
  if (typeof raw !== "string") return "good";
  const norm = raw.trim().toLowerCase().replace(/[\s-]/g, "_");
  const match = CONDITIONS.find((c) => c === norm);
  return match ?? "good";
}

function clampInt(n: unknown, fallback: number, max = 100000): number {
  const parsed = typeof n === "number" ? n : parseFloat(String(n));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.round(parsed), max);
}

function extractJson(text: string): unknown {
  // Strip code fences if present
  const cleaned = text.replace(/```json\s*|```/g, "").trim();
  // Try parsing whole thing first (responseMimeType:application/json gives clean JSON)
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to regex extraction
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response");
  return JSON.parse(match[0]);
}

export async function analyzeProductImages(
  imageUrls: string[]
): Promise<ProductVisionResult> {
  if (imageUrls.length === 0) {
    throw new Error("At least one image URL required");
  }
  if (imageUrls.length > 10) {
    throw new Error("Maximum 10 images per request");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const images = await Promise.all(imageUrls.map(fetchImageAsBase64));

  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [{ text: PROMPT }];
  for (const img of images) {
    parts.push({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    });
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
        // Disable Gemini 2.5's thinking tokens — they silently eat the output
        // budget and cause truncation. We want direct JSON, not reasoning.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini returned ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Empty response from Gemini: ${JSON.stringify(data).slice(0, 300)}`);

  const parsedJson = extractJson(text);
  // If Gemini returns an array (e.g., user sent photos of different items by
  // mistake), collapse to the first entry so the review UI shows something
  // useful rather than erroring.
  const raw = (Array.isArray(parsedJson) ? parsedJson[0] : parsedJson) as Record<
    string,
    unknown
  >;
  if (!raw || typeof raw !== "object") {
    throw new Error("Unexpected response shape from Gemini");
  }

  const low = clampInt(raw.suggested_price_low, 5, 10000);
  const mid = clampInt(raw.suggested_price_mid, Math.max(low, 10), 10000);
  const high = clampInt(raw.suggested_price_high, Math.max(mid, 20), 10000);

  return {
    title: String(raw.title || "Untitled item").slice(0, 100),
    description: String(raw.description || ""),
    category: normalizeCategory(raw.category),
    condition: normalizeCondition(raw.condition),
    suggestedPriceLow: low,
    suggestedPriceMid: mid,
    suggestedPriceHigh: high,
    confidence:
      typeof raw.confidence === "number"
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.5,
    identifyingDetails: Array.isArray(raw.identifying_details)
      ? raw.identifying_details.map((x) => String(x)).slice(0, 10)
      : [],
    aspects: normalizeAspects(raw.aspects),
  };
}

const ASPECT_KEYS: (keyof EbayAspects)[] = [
  "Brand",
  "Color",
  "Size",
  "Material",
  "Type",
  "Style",
  "Department",
  "Country/Region of Manufacture",
  "MPN",
  "Model",
];

function normalizeAspects(raw: unknown): EbayAspects {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const out: EbayAspects = {};
  for (const key of ASPECT_KEYS) {
    const v = source[key];
    if (typeof v === "string") {
      const trimmed = v.trim();
      const lower = trimmed.toLowerCase();
      if (
        trimmed &&
        lower !== "unknown" &&
        lower !== "n/a" &&
        lower !== "none" &&
        lower !== "null"
      ) {
        out[key] = trimmed;
      }
    }
  }
  return out;
}
