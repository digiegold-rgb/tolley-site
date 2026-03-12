/**
 * Content Engine — AI content generation pipeline.
 *
 * Input: listing/client/dossier context + platform + category
 * Output: platform-formatted post body + hashtags
 *
 * Uses existing chatCompletion() from lib/llm.ts — no changes to llm.ts needed.
 */

import { chatCompletion } from "@/lib/llm";
import { buildContentPrompt, buildHashtagPrompt } from "./prompts";
import type { ContentGenerateInput, PlatformType } from "./types";

// ── Platform Character Limits ───────────────────────────────

const PLATFORM_MAX_LENGTH: Record<PlatformType, number> = {
  linkedin: 3000,
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  youtube: 5000,
  tiktok: 2200,
};

// ── Main Generation Function ────────────────────────────────

export interface GeneratedContent {
  body: string;
  hashtags: string[];
  aiPromptUsed: string;
  tokensUsed: number;
}

/**
 * Generate social media content using AI.
 *
 * @param input - Context including platform, category, listing/client/dossier data
 * @param opts - Optional userId and route for usage tracking
 */
export async function generateContent(
  input: ContentGenerateInput,
  opts?: { userId?: string; subscriberId?: string }
): Promise<GeneratedContent> {
  // 1. Build context string from available data
  const context = buildContextString(input);

  // 2. Build the full system prompt
  const systemPrompt = buildContentPrompt(
    input.platform,
    input.category,
    context,
    input.customInstructions
  );

  // 3. Determine max tokens based on platform
  const maxLength = PLATFORM_MAX_LENGTH[input.platform] || 1000;
  // Rough estimate: 1 token ≈ 4 chars, add buffer
  const maxTokens = Math.min(Math.ceil(maxLength / 3), 1000);

  // 4. Generate main content
  const completion = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate a ${input.category.replace(/_/g, " ")} post for ${input.platform}. Tone: ${input.tone || "professional"}.` },
    ],
    {
      maxTokens,
      temperature: 0.8, // slightly creative
      userId: opts?.userId,
      route: "/api/content/posts/generate",
      type: "content_generation",
      meta: {
        platform: input.platform,
        category: input.category,
        subscriberId: opts?.subscriberId,
      },
    }
  );

  let body = completion.text;

  // 5. Enforce character limit
  if (body.length > maxLength) {
    body = body.slice(0, maxLength - 3) + "...";
  }

  // 6. Strip any hashtags the LLM included in the body (we generate them separately)
  body = body.replace(/\s*#\w+/g, "").trim();

  // 7. Generate hashtags separately
  const hashtags = await generateHashtags(input.platform, body, opts?.userId);

  return {
    body,
    hashtags,
    aiPromptUsed: systemPrompt.slice(0, 2000), // store truncated for reference
    tokensUsed: completion.tokensUsed,
  };
}

// ── Hashtag Generation ──────────────────────────────────────

async function generateHashtags(
  platform: PlatformType,
  postBody: string,
  userId?: string
): Promise<string[]> {
  const count = platform === "twitter" ? 3 : platform === "linkedin" ? 5 : 10;
  const prompt = buildHashtagPrompt(platform, postBody, count);

  try {
    const completion = await chatCompletion(
      [
        { role: "system", content: "You are a social media hashtag expert. Return ONLY hashtags, one per line." },
        { role: "user", content: prompt },
      ],
      {
        maxTokens: 100,
        temperature: 0.6,
        userId,
        route: "/api/content/posts/generate",
        type: "content_generation",
        meta: { subTask: "hashtags" },
      }
    );

    return completion.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("#"))
      .slice(0, count);
  } catch {
    // Fallback hashtags if generation fails
    return ["#RealEstate", "#KansasCity", "#Homes"];
  }
}

// ── Context Builder ─────────────────────────────────────────

function buildContextString(input: ContentGenerateInput): string {
  const parts: string[] = [];

  if (input.templatePrompt) {
    parts.push(`Template: ${input.templatePrompt}`);
  }

  if (input.listing) {
    const l = input.listing;
    const details = [
      `Address: ${l.address}`,
      l.city && `City: ${l.city}`,
      l.zip && `ZIP: ${l.zip}`,
      l.listPrice && `List Price: $${l.listPrice.toLocaleString()}`,
      l.beds && `Beds: ${l.beds}`,
      l.baths && `Baths: ${l.baths}`,
      l.sqft && `Sqft: ${l.sqft.toLocaleString()}`,
      l.propertyType && `Type: ${l.propertyType}`,
      l.daysOnMarket != null && `Days on Market: ${l.daysOnMarket}`,
      l.status && `Status: ${l.status}`,
    ].filter(Boolean);
    parts.push(`PROPERTY:\n${details.join("\n")}`);
  }

  if (input.client) {
    const c = input.client;
    const details = [
      `Name: ${c.firstName} ${c.lastName}`,
      c.buyerSeller && `Type: ${c.buyerSeller}`,
      c.preferredCities?.length && `Preferred Cities: ${c.preferredCities.join(", ")}`,
      c.moveTimeline && `Timeline: ${c.moveTimeline}`,
    ].filter(Boolean);
    parts.push(`CLIENT:\n${details.join("\n")}`);
  }

  if (input.dossier) {
    const d = input.dossier;
    const details = [
      d.motivationScore != null && `Motivation Score: ${d.motivationScore}/100`,
      d.motivationFlags?.length && `Flags: ${d.motivationFlags.join(", ")}`,
      d.researchSummary && `Summary: ${d.researchSummary}`,
    ].filter(Boolean);
    if (details.length > 0) {
      parts.push(`DOSSIER INSIGHTS:\n${details.join("\n")}`);
    }
  }

  return parts.join("\n\n") || "General real estate content for Kansas City metro area.";
}
