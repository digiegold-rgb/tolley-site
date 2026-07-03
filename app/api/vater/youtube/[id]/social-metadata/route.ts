/**
 * POST /api/vater/youtube/[id]/social-metadata?platform=<p>
 *
 * Generate platform-tailored title, description, and hashtags for a
 * completed vater/youtube project. Read-only — does NOT mutate project
 * state. Called from the Library's Share modal to pre-fill the upload form.
 *
 * Per-platform heuristics:
 *   - youtube: long description (up to 5000 chars), SEO keywords, tag list,
 *     chapter timestamps if the script has clear sections
 *   - tiktok: punchy 150-char description, 3-5 trending hashtags
 *   - instagram: 200-char caption, 8-12 hashtags mixing broad + niche
 *   - facebook: conversational 300-char post, link-friendly
 *   - pinterest: descriptive 200-char caption, keyword-heavy for search
 *   - twitter: ≤280 chars including link, 1-2 hashtags
 *   - linkedin: professional 1300-char post, industry-relevant keywords
 *
 * Model: Gemini 2.5 Flash (fast, free tier for text) — no Qwen/DGX needed
 * since this is a short bounded prompt.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { recordUsage } from "@/lib/vater/billing/record-usage";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PLATFORM_GUIDE: Record<string, string> = {
  youtube:
    "YouTube long-form. Title ≤ 100 chars, click-worthy but honest. " +
    "Description up to 500 chars with 2 short paragraphs + 3-5 SEO keywords " +
    "naturally placed. Hashtags: 3-5 broad tags (no #YouTube or #video).",
  tiktok:
    "TikTok short-form. Description ≤ 150 chars, punchy hook, ends with " +
    "CTA. Hashtags: 4-6, mix of trending + niche. Never include platform " +
    "names in hashtags.",
  instagram:
    "Instagram Reels. Caption 150-220 chars, engagement-focused question " +
    "in line 2. Hashtags: 10-15 mixing broad (1M+), mid (100K-1M), and " +
    "niche (<100K) tags. No banned hashtags.",
  facebook:
    "Facebook feed post. 200-300 chars, conversational, asks a question at " +
    "the end to drive comments. Hashtags: 2-3 only (Facebook de-prioritizes " +
    "hashtag-heavy posts).",
  pinterest:
    "Pinterest pin description. 150-250 chars, keyword-rich, mentions " +
    "concrete benefits. Hashtags: 5-10 niche + broad, space-separated.",
  twitter:
    "Twitter/X post. ≤ 260 chars total including a 23-char link allowance. " +
    "Single punchy hook. Hashtags: 1-2 max, embedded in the sentence.",
  linkedin:
    "LinkedIn post. 800-1300 chars, professional tone, industry insight or " +
    "lesson framing. Hashtags: 3-5 industry tags at the end.",
};

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const platform = (new URL(req.url).searchParams.get("platform") ?? "").trim();
  if (!platform || !PLATFORM_GUIDE[platform]) {
    return NextResponse.json(
      {
        error: `platform query param required, one of: ${Object.keys(PLATFORM_GUIDE).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      sourceTitle: true,
      topic: true,
      script: true,
      goal: true,
      stylePreset: true,
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const sourceTitle = project.sourceTitle ?? project.topic ?? "Untitled";
  // Cap script so the prompt stays under ~4K tokens total.
  const script = (project.script ?? "").slice(0, 6000);
  if (!script) {
    return NextResponse.json(
      {
        error:
          "Project has no script yet — complete the pipeline before generating social metadata.",
      },
      { status: 409 },
    );
  }

  // Bill the project OWNER, not the acting session (admin-assist safety —
  // mirrors poll/route.ts:490). Legacy null-owner rows are admin-only.
  const billingUserId = project.userId ?? session.user.id;

  // ── Billing gate (action "description", 10¢): block BEFORE the LLM call ──
  const budget = await checkBudget(billingUserId, "description");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY not configured — social metadata generation unavailable.",
      },
      { status: 503 },
    );
  }

  const system =
    `You write social-media metadata for AI-narrated YouTube-style videos. ` +
    `Return ONE JSON object with exactly these keys: ` +
    `title (string), description (string), hashtags (string array, no # prefix). ` +
    `Follow the platform guide exactly:\n\n${PLATFORM_GUIDE[platform]}\n\n` +
    `Do not include emojis unless the platform guide specifies them. ` +
    `Never invent facts that aren't in the script.`;

  const userPrompt =
    `Platform: ${platform}\n` +
    `Video source title: ${sourceTitle}\n` +
    (project.goal ? `Goal: ${project.goal}\n` : "") +
    `\nScript:\n${script}\n\n` +
    `Return the JSON only — no preamble, no markdown fences.`;

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          // Per memory/feedback_gemini_thinking_budget.md: thinkingBudget=0
          // forces a complete JSON response instead of a truncated one.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Gemini HTTP ${res.status}`,
          detail: errText.slice(0, 500),
        },
        { status: 502 },
      );
    }

    type GeminiResponse = {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    type Parsed = { title?: unknown; description?: unknown; hashtags?: unknown };
    let parsed: Parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Gemini returned non-JSON", raw: text.slice(0, 500) },
        { status: 502 },
      );
    }

    // ── Charge only after confirmed success (failed generations never
    // charge). Unique key per call — each POST is a fresh generation; the
    // key just makes the Stripe write retry-safe. try/catch: a billing
    // hiccup must not 500 a response the user already earned.
    if (project.userId) {
      try {
        await recordUsage({
          userId: project.userId,
          action: "description",
          projectId: id,
          idempotencyKey: `social_${id}_${platform}_${Date.now()}`,
        });
      } catch (err) {
        console.error(
          `[vater/social-metadata] recordUsage failed project=${id} platform=${platform}`,
          err,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      platform,
      title: typeof parsed.title === "string" ? parsed.title : sourceTitle,
      description:
        typeof parsed.description === "string" ? parsed.description : "",
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags
            .filter((h): h is string => typeof h === "string")
            .map((h) => h.replace(/^#+/, "").trim())
            .filter(Boolean)
            .slice(0, 15)
        : [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
