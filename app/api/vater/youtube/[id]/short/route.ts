/**
 * POST /api/vater/youtube/[id]/short
 *
 * Cut a vertical short-form promo from a finished long-form (Trey,
 * 2026-08-09: "create a short form video that advertises this long form
 * video"). The DGX does a pure-ffmpeg hook cut (first ~30s, 9:16 blurred
 * pillarbox, fade-out) — no GPU spend — and this route waits for it, then
 * writes `shortVideoUrl` + a Gemini-drafted `shortDescription` that links
 * the published YouTube URL when one exists.
 *
 * Explicit-click only, like /publish: nothing schedules this. Re-running
 * overwrites the previous cut (same blob key) — that's intentional so an
 * edited long-form gets a fresh promo.
 *
 * Body: { maxSeconds?: number }  (10–60, default 30)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";

// Download + ffmpeg + blob upload on the DGX runs well under this, but a
// 10-min 1080p final is a big file — leave headroom like /publish does.
export const maxDuration = 300;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type Ctx = { params: Promise<{ id: string }> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function draftShortDescription(input: {
  sourceTitle: string;
  script: string;
  youtubeUrl: string | null;
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const link = input.youtubeUrl
    ? `The full video is live at ${input.youtubeUrl} — the description MUST include that exact URL with a watch-the-full-video CTA.`
    : `The full video is not published yet — end with "Full video on our YouTube channel" (no URL).`;
  const system =
    "You write cross-post captions for short-form videos that advertise a " +
    "long-form YouTube video. Return PLAIN TEXT only (no JSON, no markdown): " +
    "a 1-2 sentence hook (≤200 chars) drawn from the script's strongest idea, " +
    "then the CTA line, then 4-6 hashtags on the last line. " +
    "Never invent facts that aren't in the script. " +
    link;
  const user = `Video title: ${input.sourceTitle}\n\nScript:\n${input.script.slice(0, 6000)}`;
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.finalVideoUrl) {
    return NextResponse.json(
      { error: "Project has no final video yet — render it first" },
      { status: 409 },
    );
  }

  let maxSeconds = 30;
  try {
    const body = (await req.json()) as { maxSeconds?: unknown };
    if (typeof body.maxSeconds === "number") {
      maxSeconds = Math.max(10, Math.min(60, Math.round(body.maxSeconds)));
    }
  } catch {
    // empty body is fine
  }

  try {
    const { jobId } = await autopilot.makeShort({
      projectId: id,
      videoUrl: project.finalVideoUrl,
      maxSeconds,
    });

    // The cut is minutes of work at most; poll until done or our own budget
    // runs out. On timeout the DGX job keeps running — a retry click finds
    // the fresh blob by overwrite, so nothing is stranded.
    const deadline = Date.now() + 240_000;
    let shortVideoUrl: string | null = null;
    while (Date.now() < deadline) {
      await sleep(5000);
      const job = await autopilot.getJob(jobId);
      if (job.status === "failed") {
        const detail =
          (job.result as { error?: string } | null)?.error ?? "unknown error";
        return NextResponse.json(
          { error: `Short cut failed: ${detail}` },
          { status: 502 },
        );
      }
      if (job.status === "done") {
        shortVideoUrl =
          (job.result as { shortVideoUrl?: string } | null)?.shortVideoUrl ??
          null;
        break;
      }
    }
    if (!shortVideoUrl) {
      return NextResponse.json(
        { error: "Short cut timed out — try again in a minute" },
        { status: 504 },
      );
    }

    const shortDescription = await draftShortDescription({
      sourceTitle:
        project.publishTitle ?? project.sourceTitle ?? "this video",
      script: project.script ?? "",
      youtubeUrl: project.youtubeVideoId
        ? `https://youtu.be/${project.youtubeVideoId}`
        : null,
    });

    const updated = await prisma.youTubeProject.update({
      where: { id },
      data: {
        shortVideoUrl,
        ...(shortDescription ? { shortDescription } : {}),
      },
    });
    return NextResponse.json({ project: updated });
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    console.error(`[vater/short] project=${id} failed: ${detail}`);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
