/**
 * Content Engine — AI prompt templates for social media content.
 *
 * Mirrors the pattern from lib/sms-prompts.ts:
 * - Shared rules for brand consistency
 * - Category-specific templates
 * - Platform-specific variants
 */

import type { ContentCategory, PlatformType } from "./types";

// ── Shared Rules ────────────────────────────────────────────

const BRAND_RULES = `
RULES:
- Write as a knowledgeable, approachable real estate professional in the Kansas City metro.
- Be specific — use real numbers, neighborhoods, and market data when provided.
- Never fabricate statistics or market claims. Only use data provided in context.
- Include a clear call-to-action (CTA) in every post.
- Avoid cliches like "dream home", "nestled in", "stunning".
- No excessive emojis — max 2-3 per post, strategically placed.
- Do NOT include hashtags in the body — they'll be added separately.
- Write in first person as the agent, not third person.
`.trim();

// ── Platform-Specific Formatting Rules ──────────────────────

const PLATFORM_RULES: Record<PlatformType, string> = {
  linkedin: `
LINKEDIN FORMAT:
- Professional, educational tone. Think "industry insight" not "sales pitch".
- 1200-1800 characters ideal (up to 3000 max).
- Use line breaks for readability — short paragraphs (2-3 lines max).
- Start with a hook line that stops the scroll.
- End with a question or CTA to drive comments.
- Mention relevant connections or experiences where applicable.
`.trim(),

  twitter: `
X/TWITTER FORMAT:
- Punchy, concise — 240 chars max (leave room for link/media).
- One clear idea per tweet. No fluff.
- Use numbers and data points to grab attention.
- Thread-friendly: make it work as a standalone tweet but hint at more.
- Conversational, direct tone.
`.trim(),

  facebook: `
FACEBOOK FORMAT:
- Conversational, community-focused tone.
- 300-800 characters ideal.
- Ask questions to drive engagement.
- Reference local landmarks, events, or neighborhoods.
- Good for storytelling — share brief anecdotes or client wins (anonymized).
`.trim(),

  instagram: `
INSTAGRAM FORMAT:
- Visual-first — the caption supports the image.
- 300-500 characters for feed, shorter for Stories.
- Conversational and relatable.
- CTA: "Link in bio", "DM me", "Save this post".
- Line breaks between sections.
`.trim(),

  youtube: `
YOUTUBE FORMAT:
- Title: 60 chars max, keyword-rich, curiosity-driving.
- Description: 2-3 sentence summary + chapters + links.
- Hook in first 2 sentences of description.
`.trim(),

  tiktok: `
TIKTOK FORMAT:
- Ultra-casual, trend-aware tone.
- Caption: 150 chars max.
- Hook immediately — "Here's what nobody tells you about..."
- Educational but entertaining.
`.trim(),
};

// ── Category Templates ──────────────────────────────────────

interface ContentPromptConfig {
  id: ContentCategory;
  label: string;
  description: string;
  systemPrompt: string;
}

const CATEGORY_PROMPTS: Record<ContentCategory, ContentPromptConfig> = {
  market_update: {
    id: "market_update",
    label: "Market Update",
    description: "Local market stats, trends, and insights",
    systemPrompt: `Generate a market update post for the Kansas City metro real estate market.

Use any market data provided in context (median prices, inventory levels, days on market, interest rates).
If specific data is provided, cite it. If not, write a general market insight based on the season and current trends.

Focus on: what buyers/sellers need to know RIGHT NOW and what action they should take.

{{context}}

${BRAND_RULES}`,
  },

  listing_promo: {
    id: "listing_promo",
    label: "Listing Promotion",
    description: "Promote a specific listing",
    systemPrompt: `Generate a post promoting a specific property listing.

Property details:
{{context}}

Highlight the top 2-3 features that make this property stand out. Create urgency without being pushy.
If price drops or days on market are notable, weave them in naturally.
End with a CTA to schedule a showing or get more info.

${BRAND_RULES}`,
  },

  neighborhood_spotlight: {
    id: "neighborhood_spotlight",
    label: "Neighborhood Spotlight",
    description: "Highlight a local neighborhood or area",
    systemPrompt: `Generate a neighborhood spotlight post.

Neighborhood/area context:
{{context}}

Cover: what makes this area special, who it's ideal for (families, professionals, retirees),
key amenities (schools, parks, restaurants), price ranges, and lifestyle.

${BRAND_RULES}`,
  },

  seller_tip: {
    id: "seller_tip",
    label: "Seller Tip",
    description: "Actionable advice for home sellers",
    systemPrompt: `Generate a helpful tip post for home sellers.

Topic context:
{{context}}

Share ONE specific, actionable tip. Be concrete — "repaint your front door" beats "improve curb appeal".
Include a stat or data point if available. Position yourself as the expert who knows what actually moves the needle.

${BRAND_RULES}`,
  },

  buyer_guide: {
    id: "buyer_guide",
    label: "Buyer Guide",
    description: "Tips and guides for home buyers",
    systemPrompt: `Generate a helpful post for home buyers.

Topic context:
{{context}}

Share practical buying advice. Cover common pitfalls, negotiation tips, or market-specific guidance.
If this is for first-time buyers, avoid jargon. If for investors, be data-driven.

${BRAND_RULES}`,
  },

  just_sold: {
    id: "just_sold",
    label: "Just Sold",
    description: "Celebrate a closed deal",
    systemPrompt: `Generate a "Just Sold" celebration post.

Property/deal context:
{{context}}

Celebrate the win without revealing private client details. Focus on the outcome:
neighborhood, price range, how quickly it sold, any notable aspects of the deal.
Include a subtle CTA: "Thinking of selling? Let's chat about what your home is worth."

${BRAND_RULES}`,
  },

  open_house: {
    id: "open_house",
    label: "Open House",
    description: "Promote an upcoming open house",
    systemPrompt: `Generate an open house promotion post.

Event details:
{{context}}

Create excitement and urgency. Include: date, time, address, top 2-3 features.
CTA: "Stop by this weekend" or "Can't make it? DM me for a private showing."

${BRAND_RULES}`,
  },

  personal_brand: {
    id: "personal_brand",
    label: "Personal Brand",
    description: "Build agent brand and trust",
    systemPrompt: `Generate a personal branding post for a real estate agent.

Context:
{{context}}

This post should build trust and show the human side of the business.
Topics: behind-the-scenes, lessons learned, client success stories (anonymized),
community involvement, market philosophy, or professional milestones.

${BRAND_RULES}`,
  },
};

// ── Public API ──────────────────────────────────────────────

/**
 * Build the full system prompt for content generation.
 * Combines platform rules + category template + context.
 */
export function buildContentPrompt(
  platform: PlatformType,
  category: ContentCategory,
  context: string,
  customInstructions?: string
): string {
  const categoryConfig = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.market_update;
  const platformRule = PLATFORM_RULES[platform] || PLATFORM_RULES.twitter;

  let prompt = categoryConfig.systemPrompt.replace("{{context}}", context || "No specific context provided.");
  prompt = `${platformRule}\n\n${prompt}`;

  if (customInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${customInstructions}`;
  }

  return prompt;
}

/**
 * Build a hashtag generation prompt.
 */
export function buildHashtagPrompt(
  platform: PlatformType,
  postBody: string,
  count: number = 5
): string {
  return `Generate exactly ${count} relevant hashtags for the following ${platform} post about real estate in Kansas City.

POST:
${postBody}

Return ONLY the hashtags, one per line, with # prefix. No explanations.
Mix trending broad hashtags with niche local ones.
For LinkedIn: keep it professional (#RealEstate #KansasCity).
For Twitter: mix trending + niche (#KC #HomeBuying).
For Instagram: include location-specific (#KansasCityHomes #KCRealEstate).`;
}

/** Get all available categories for UI display */
export function getContentCategories(): { id: ContentCategory; label: string; description: string }[] {
  return Object.values(CATEGORY_PROMPTS).map(({ id, label, description }) => ({ id, label, description }));
}

/** Get platform display info */
export function getPlatformInfo(): { platform: PlatformType; label: string; maxLength: number }[] {
  return [
    { platform: "linkedin", label: "LinkedIn", maxLength: 3000 },
    { platform: "twitter", label: "X / Twitter", maxLength: 280 },
    { platform: "facebook", label: "Facebook", maxLength: 63206 },
    { platform: "instagram", label: "Instagram", maxLength: 2200 },
    { platform: "youtube", label: "YouTube", maxLength: 5000 },
    { platform: "tiktok", label: "TikTok", maxLength: 2200 },
  ];
}
