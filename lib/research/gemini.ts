/**
 * Cloud research engine — Gemini with Google Search grounding.
 *
 * Runs entirely in the Vercel function: one grounded generateContent call
 * does the searching + reading and returns the answer in ~5-40s. No DGX
 * dependency.
 *
 * Citations are NOT parsed from model-emitted JSON (grounded Gemini
 * reliably ignores strict output contracts — we tested). Instead they are
 * built deterministically from the API's own groundingMetadata:
 * groundingSupports maps each answer segment to the groundingChunks
 * (real pages Google served the model). Those become the claims, and
 * lib/research/verify.ts then re-fetches each page and checks the claim
 * is actually supported — so the ✓ marks never depend on model honesty.
 *
 * Per memory feedback_gemini_thinking_budget: thinkingBudget 0 on flash.
 */

import type { ResearchAnswer, ResearchClaim } from "./prompt";

const GEMINI_MODEL = process.env.RESEARCH_GEMINI_MODEL || "gemini-pro-latest";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
/** Cap the claims ledger — longest/most-cited segments win. */
const MAX_CLAIMS = 12;

function endpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function buildGroundedPrompt(query: string): string {
  return `You are a rigorous research analyst with Google Search access. Research this question thoroughly and write a complete, well-organized answer.

QUESTION: "${query}"

Requirements:
- Search multiple times with different phrasings — include manufacturer names, product/grade codes, datasheet terms. If the question involves a product code, first work out what the code means (maker, spec, naming convention), then find comparables.
- Base every factual statement on pages you found through search. If something cannot be confirmed, say so explicitly in a final "What could not be verified" section — never fill gaps silently from prior knowledge.
- Prefer primary sources: manufacturer pages, official datasheets, standards bodies, then reputable databases and distributors.
- Answer in markdown. Use a comparison table when comparing products/options. Include concrete numbers (specs, percentages, model codes) wherever the sources give them.
- Be decisive: end with a short "Bottom line" section naming the best answer(s).`;
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}
interface GroundingSupport {
  segment?: { startIndex?: number; endIndex?: number; text?: string };
  groundingChunkIndices?: number[];
  confidenceScores?: number[];
}
interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[];
      groundingSupports?: GroundingSupport[];
      webSearchQueries?: string[];
    };
  }>;
  error?: { message?: string };
}

export interface GroundedResult {
  answer: ResearchAnswer;
  /** Search queries grounding actually ran (shown in the step log). */
  searchQueries: string[];
}

export async function runGeminiResearch(query: string): Promise<GroundedResult> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

  const body = {
    contents: [{ role: "user", parts: [{ text: buildGroundedPrompt(query) }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      // Only 2.5-flash takes thinkingBudget (0 = required there to avoid
      // truncation, per memory); 3.x models use a different thinking API
      // and reject the field.
      ...(GEMINI_MODEL.includes("2.5-flash")
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  };

  const res = await fetch(`${endpoint(GEMINI_MODEL)}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110_000),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini research failed: ${res.status} ${errBody.slice(0, 200)}`);
  }
  const data = (await res.json()) as GeminiResponse;
  if (data.error) throw new Error(`Gemini error: ${data.error.message}`);

  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (text.length < 200) {
    throw new Error(`Gemini returned an unusably short answer (${text.length} chars, finish=${candidate?.finishReason})`);
  }

  const meta = candidate?.groundingMetadata;
  const chunks = meta?.groundingChunks ?? [];
  const supports = meta?.groundingSupports ?? [];
  const claims = buildClaimsFromGrounding(supports, chunks);
  if (claims.length === 0) {
    throw new Error("Gemini answered without grounding citations — refusing to ship an unsourced answer");
  }

  return {
    answer: {
      answerMarkdown: text,
      claims,
      // Placeholder until verification: scaled by how much of the answer
      // Google grounded at all. Verification recomputes the final score.
      overallConfidence: Math.min(85, 40 + claims.length * 5),
      unverifiedNotes: undefined,
    },
    searchQueries: meta?.webSearchQueries ?? [],
  };
}

/**
 * Turn Google's segment→source mapping into our claims ledger. Segments
 * are the model's own sentences; the sources are the real pages Google
 * grounded them on. Longest, best-cited segments first.
 */
function buildClaimsFromGrounding(
  supports: GroundingSupport[],
  chunks: GroundingChunk[]
): ResearchClaim[] {
  // Merge duplicate segments (grounding often emits the same span once per
  // supporting chunk) — union their chunk indices.
  const bySegment = new Map<string, GroundingSupport>();
  for (const s of supports) {
    const key = (s.segment?.text ?? "").trim();
    if (!key) continue;
    const prior = bySegment.get(key);
    if (prior) {
      prior.groundingChunkIndices = [
        ...new Set([...(prior.groundingChunkIndices ?? []), ...(s.groundingChunkIndices ?? [])]),
      ];
    } else {
      bySegment.set(key, { ...s, groundingChunkIndices: [...(s.groundingChunkIndices ?? [])] });
    }
  }

  const usable = [...bySegment.values()]
    .filter(
      (s) =>
        (s.segment?.text ?? "").trim().length >= 40 &&
        (s.groundingChunkIndices?.length ?? 0) > 0
    )
    .sort(
      (a, b) =>
        (b.segment?.text?.length ?? 0) + (b.groundingChunkIndices?.length ?? 0) * 50 -
        ((a.segment?.text?.length ?? 0) + (a.groundingChunkIndices?.length ?? 0) * 50)
    )
    .slice(0, MAX_CLAIMS);

  return usable.map((s) => {
    const sources = (s.groundingChunkIndices ?? [])
      .map((i) => chunks[i])
      .filter((c): c is GroundingChunk => Boolean(c?.web?.uri))
      .map((c) => ({
        url: c.web!.uri!,
        title: c.web!.title || c.web!.uri!,
        quote: undefined as string | undefined,
      }));
    const avgConf =
      s.confidenceScores && s.confidenceScores.length
        ? Math.round((s.confidenceScores.reduce((a, b) => a + b, 0) / s.confidenceScores.length) * 100)
        : 70;
    return {
      text: (s.segment!.text as string).trim(),
      sources,
      verified: false, // set by the deterministic verify pass, never by the model
      confidence: Math.max(0, Math.min(100, avgConf)),
    };
  });
}
