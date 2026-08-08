/**
 * POST /api/vater/youtube/[id]/thumbnail-concepts
 *
 * Returns exactly 3 thumbnail concepts for a finished project, generated from
 * the script so each one depicts something that actually happens in the video.
 * Read-only — picking a concept is a separate PATCH, and rendering it is the
 * existing /thumbnail route.
 *
 * Each concept: { conceptTitle, sceneDescription, overlayText }. `overlayText`
 * is capped at TWO WORDS, both in the prompt and again on the way out — the
 * on-image text has to read at phone-thumbnail size.
 *
 * Model + call shape copied from social-metadata/route.ts (Gemini 2.5 Flash,
 * JSON response mime, thinkingBudget 0 per feedback_gemini_thinking_budget).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type Ctx = { params: Promise<{ id: string }> };

export interface ThumbnailConcept {
  conceptTitle: string;
  sceneDescription: string;
  overlayText: string;
}

/** Two words maximum, punctuation stripped — the prompt asks for it, this
 *  enforces it so a chatty model can't leak a sentence onto the image. */
function clampOverlay(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/["'?!.,:;]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      sourceTitle: true,
      topic: true,
      publishTitle: true,
      script: true,
      goal: true,
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const script = (project.script ?? "").slice(0, 6000);
  if (!script) {
    return NextResponse.json(
      {
        error:
          "Project has no script yet — thumbnail concepts are derived from it.",
      },
      { status: 409 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY not configured — thumbnail concepts unavailable.",
      },
      { status: 503 },
    );
  }

  const system =
    `You design YouTube thumbnails for narrated animated videos. ` +
    `Return ONE JSON object: {"concepts": [...]} with EXACTLY 3 concepts. ` +
    `Each concept has exactly these keys: ` +
    `conceptTitle (string, a short internal name for the idea), ` +
    `sceneDescription (string, 1-2 sentences describing the single image to ` +
    `render — subject, setting, composition, mood), ` +
    `overlayText (string, AT MOST TWO WORDS burned onto the image).\n\n` +
    `HARD RULES:\n` +
    `1. Every concept must depict a moment or object that genuinely appears ` +
    `in the script. Never promise something the video does not deliver — no ` +
    `clickbait mismatch, no invented statistics, no shocked faces about ` +
    `events that never happen.\n` +
    `2. overlayText is TWO WORDS MAXIMUM. One word is better. No punctuation, ` +
    `no hashtags, no emoji.\n` +
    `3. The three concepts must be visually different from each other — not ` +
    `the same scene reworded.\n` +
    `4. sceneDescription describes ONE still image, not a sequence.`;

  const userPrompt =
    `Video title: ${project.publishTitle || project.sourceTitle || project.topic || "Untitled"}\n` +
    (project.goal ? `Goal: ${project.goal}\n` : "") +
    `\nScript:\n${script}\n\n` +
    `Return the JSON only — no preamble, no markdown fences.`;

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Gemini HTTP ${res.status}`, detail: errText.slice(0, 500) },
      { status: 502 },
    );
  }

  type GeminiResponse = {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: { concepts?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Gemini returned non-JSON", raw: text.slice(0, 500) },
      { status: 502 },
    );
  }

  const concepts: ThumbnailConcept[] = (
    Array.isArray(parsed.concepts) ? parsed.concepts : []
  )
    .map((c): ThumbnailConcept | null => {
      if (!c || typeof c !== "object") return null;
      const e = c as Record<string, unknown>;
      const sceneDescription =
        typeof e.sceneDescription === "string" ? e.sceneDescription.trim() : "";
      if (!sceneDescription) return null;
      return {
        conceptTitle:
          typeof e.conceptTitle === "string" && e.conceptTitle.trim()
            ? e.conceptTitle.trim()
            : "Concept",
        sceneDescription,
        overlayText: clampOverlay(e.overlayText),
      };
    })
    .filter((c): c is ThumbnailConcept => c !== null)
    .slice(0, 3);

  if (concepts.length === 0) {
    return NextResponse.json(
      { error: "Gemini returned no usable concepts", raw: text.slice(0, 500) },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, concepts });
}
