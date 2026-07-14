/**
 * Caption + title + hashtag generator for /social.
 *
 * Routes through the LiteLLM gateway on the DGX (LITELLM_API_URL) using
 * model "Qwen/Qwen3.6-27B" — local, free, no Modal/Kimi cost. Matches the
 * routing other tolley-site code uses (lib/budget/llm.ts).
 *
 * When a transcript of the video's audio is supplied, the copy is grounded in
 * what's ACTUALLY said/happening — the title is a fun content-driven hook, the
 * caption opens with a hook line pulled from the moment. No emojis anywhere
 * (they break the TikTok Selenium poster and read as spam), and every caption
 * ends with the CTA link so viewers get routed to https://tolley.io/start.
 */

const LLM_BASE = process.env.LITELLM_API_URL || process.env.LLM_API_URL || "";
const LLM_KEY = process.env.LITELLM_API_KEY || process.env.LLM_API_KEY || "";
const LLM_MODEL_LOCAL = "Qwen/Qwen3.6-27B";
const LLM_MODEL_FALLBACK =
  process.env.LITELLM_MODEL || process.env.LLM_MODEL || "fallback/kimi-k2-turbo";

const FETCH_TIMEOUT_MS = 25_000;
const CTA_URL = "https://tolley.io/start";

export type CaptionPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest";

export interface CaptionRequest {
  platforms: CaptionPlatform[];
  hint?: string;
  topic?: string;
  transcript?: string;
}

export interface CaptionResponse {
  title: string;
  caption: string;
  hashtags: string[];
  perPlatform?: Partial<Record<CaptionPlatform, string>>;
  modelUsed: string;
  transcriptUsed: boolean;
}

const PLATFORM_GUIDANCE: Record<CaptionPlatform, string> = {
  tiktok:
    "TikTok: 1-2 punchy hooks, casual tone, ≤150 chars, no fluff. Use a question or a stat as the hook.",
  instagram:
    "Instagram: 2-3 short paragraphs, visual storytelling, ≤300 chars before the hashtag block. No emoji.",
  youtube:
    "YouTube: SEO-driven, lead with the keyword, 1-2 sentences, ≤200 chars; assume the title carries the hook.",
  facebook:
    "Facebook: conversational, slightly longer (2-4 sentences), no emoji. Asks the viewer to comment.",
  pinterest:
    "Pinterest: keyword-dense, descriptive, no hype, ≤300 chars. Mention the use-case and audience explicitly.",
};

// Kill emoji + pictographs + variation selectors/ZWJ. Everything outside the
// BMP goes too (ChromeDriver send_keys can't type astral chars — TikTok poster).
export function stripEmoji(text: string): string {
  return text
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/[\u2600-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D\u20E3]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildPrompt(req: CaptionRequest): string {
  const platforms = req.platforms.length > 0 ? req.platforms : (["facebook"] as const);
  const guidance = platforms
    .map((p) => `- ${p.toUpperCase()}: ${PLATFORM_GUIDANCE[p]}`)
    .join("\n");

  return [
    "You are a social-media copywriter for a hands-on multi-business operator (real estate, rentals, deliveries, e-commerce, DIY builds in Kansas City).",
    "Your job: ONE fun scroll-stopping TITLE, ONE shared CAPTION, and a hashtag block for the video described below.",
    "",
    req.transcript
      ? [
          "TRANSCRIPT of the video's audio (this is what actually happens — build the title and caption from THIS, not from generic filler):",
          `"""${req.transcript.slice(0, 4000)}"""`,
        ].join("\n")
      : "No transcript available — use the context lines below.",
    "",
    "Platforms and their style requirements:",
    guidance,
    "",
    req.topic ? `Context: ${req.topic}` : "",
    req.hint ? `Tone / angle hint from operator: ${req.hint}` : "",
    "",
    "Hard rules:",
    "- TITLE: ≤55 chars, specific and fun, pulled from the best moment/quote in the transcript. Never mention the camera brand, the date, or the word 'video'.",
    "- CAPTION: first sentence is a HOOK (a question, a bold claim, or the best quote). 2-3 sentences total. Written in first person as the operator.",
    "- ABSOLUTELY NO emojis or special symbols anywhere. Plain text only.",
    "- Do NOT include hashtags inside the caption; they go in the separate list.",
    "- MAXIMUM 4 hashtags. Pick the 4 highest-impact: 2 niche (from the actual content) + 2 reach. Fewer is fine.",
    "",
    "Return strictly JSON with this exact shape (no prose, no code fences):",
    `{"title": "...", "caption": "...", "hashtags": ["#tag1", "#tag2", ...]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function chatJSON(
  prompt: string,
  model: string,
): Promise<{ title?: string; caption?: string; hashtags?: string[] } | null> {
  if (!LLM_BASE || !LLM_KEY) return null;

  const res = await fetch(`${LLM_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You output valid JSON only. No prose. No code fences.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.7,
      // Bypass thinking mode — we need direct content, not reasoning chain.
      extra_body: { chat_template_kwargs: { enable_thinking: false } },
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const raw =
    msg?.content?.trim() ||
    msg?.reasoning_content?.trim() ||
    msg?.provider_specific_fields?.reasoning_content?.trim() ||
    "";
  if (!raw) return null;

  // Some models still wrap JSON in code fences despite instructions.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function generateCaption(req: CaptionRequest): Promise<CaptionResponse> {
  const prompt = buildPrompt(req);

  // Try local Qwen3.6 first (free), fall back to whatever LITELLM_MODEL points
  // at (typically Kimi). Keeps copy generation off the critical path of paid
  // calls when the local model is healthy.
  let parsed = null;
  let modelUsed = LLM_MODEL_LOCAL;
  try {
    parsed = await chatJSON(prompt, LLM_MODEL_LOCAL);
  } catch (err) {
    console.warn("[social/captions] Qwen3.6 failed, falling back:", err);
  }

  if (!parsed) {
    modelUsed = LLM_MODEL_FALLBACK;
    parsed = await chatJSON(prompt, LLM_MODEL_FALLBACK);
  }

  if (!parsed || !parsed.caption) {
    throw new Error("Caption generation failed (both Qwen3.6 and fallback returned nothing usable)");
  }

  const hashtags = (parsed.hashtags ?? [])
    .filter((h: unknown): h is string => typeof h === "string" && h.length > 0)
    .map((h: string) => stripEmoji(h))
    .filter((h: string) => h.length > 1)
    .map((h: string) => (h.startsWith("#") ? h : `#${h}`))
    // Jared's hard rule: 4 hashtags max, enforced here regardless of model output.
    .slice(0, 4);

  let caption = stripEmoji(parsed.caption);
  // Every caption routes viewers somewhere we can actually help them.
  if (!caption.includes("tolley.io")) {
    caption = `${caption}\n\nMore at ${CTA_URL}`;
  }

  const title = stripEmoji(parsed.title || "").slice(0, 80);

  return {
    title,
    caption,
    hashtags,
    modelUsed,
    transcriptUsed: Boolean(req.transcript),
  };
}
