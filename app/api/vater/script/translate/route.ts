/**
 * POST /api/vater/script/translate   { text, targetLanguage }  →  { text }
 *
 * Powers "Translate script →" in the Script step. Primary path is the DGX
 * (`POST /vater/script/translate`); when that answers 404/501 we fall back to
 * Kimi via LiteLLM using the same env precedence as lib/budget/llm.ts
 * (LITELLM_* first, legacy LLM_* second). With neither configured the route
 * returns 501 + `unavailable` so the button disables with a tooltip.
 *
 * The model is told to return the translation ONLY — no preamble, no notes.
 * Narration text goes straight to TTS, so a stray "Here is the translation:"
 * would be read aloud.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { dgxCall, unavailableBody } from "@/lib/vater/dgx-feature-proxy";
import { FEATURE_LANGUAGES, isFeatureLanguage } from "@/lib/vater/project-features";

export const maxDuration = 300;

const MAX_CHARS = 60_000;

const LLM_BASE = process.env.LITELLM_API_URL || process.env.LLM_API_URL || "";
const LLM_KEY = process.env.LITELLM_API_KEY || process.env.LLM_API_KEY || "";
const LLM_MODEL =
  process.env.LITELLM_MODEL || process.env.LLM_MODEL || "fallback/kimi-k2-turbo";

const LANGUAGE_NAMES = new Map(
  FEATURE_LANGUAGES.map((l) => [l.code as string, l.label]),
);

/** Narration is long; chunk on paragraph boundaries so one call never blows
 *  the output window and a mid-sentence split can't mangle a line. */
function chunk(text: string, size = 6000): string[] {
  if (text.length <= size) return [text];
  const parts: string[] = [];
  let current = "";
  for (const para of text.split(/\n\s*\n/)) {
    if (current && current.length + para.length + 2 > size) {
      parts.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) parts.push(current);
  return parts;
}

async function translateViaLiteLLM(
  text: string,
  languageName: string,
): Promise<string> {
  const out: string[] = [];
  for (const piece of chunk(text)) {
    const res = await fetch(`${LLM_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content:
              `You are a translator for video narration. Translate the user's text into ${languageName}. ` +
              "Preserve paragraph breaks exactly. Keep proper nouns, brand names and numbers as-is. " +
              "Write it to be spoken aloud, not read. Return ONLY the translation — no preamble, no notes, no quotes.",
          },
          { role: "user", content: piece },
        ],
        temperature: 0.2,
        max_tokens: 8000,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const content: string =
      msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
    if (!content) throw new Error("LLM returned an empty translation");
    out.push(content);
  }
  return out.join("\n\n");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: unknown; targetLanguage?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const targetLanguage =
    typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Script is too long to translate (max ${MAX_CHARS} chars)` },
      { status: 413 },
    );
  }
  if (!isFeatureLanguage(targetLanguage)) {
    return NextResponse.json(
      {
        error: `targetLanguage must be one of: ${[...LANGUAGE_NAMES.keys()].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const dgx = await dgxCall<{ text: string }>(
    "POST",
    "/vater/script/translate",
    { text, targetLanguage },
  );
  if (dgx.kind === "ok" && typeof dgx.data.text === "string" && dgx.data.text.trim()) {
    return NextResponse.json({ text: dgx.data.text, via: "dgx" });
  }
  if (dgx.kind === "error") {
    return NextResponse.json(
      { error: "Translation failed", detail: dgx.body.slice(0, 300) },
      { status: 502 },
    );
  }

  if (!LLM_BASE || !LLM_KEY) {
    return NextResponse.json(
      unavailableBody(
        "Translation",
        "DGX endpoint not shipped and LITELLM_API_URL/KEY not configured",
      ),
      { status: 501 },
    );
  }

  try {
    const translated = await translateViaLiteLLM(
      text,
      LANGUAGE_NAMES.get(targetLanguage) ?? targetLanguage,
    );
    return NextResponse.json({ text: translated, via: "litellm" });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Translation failed",
        detail: err instanceof Error ? err.message : "unknown error",
      },
      { status: 502 },
    );
  }
}
