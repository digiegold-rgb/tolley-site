/**
 * POST /api/vater/youtube/[id]/title/generate
 *
 * Title-step generation for the v2 ProjectShell. Three modes correspond
 * to the three Title cards in the TubeGen-parity Title step:
 *
 *   - mode='sample'  (Generate from Sample List)
 *       LLM-only. Caller supplies `sampleTitles[]`; we call
 *       `autopilot.suggestTitles({ styleSnapshot, sampleTitles, count })`,
 *       cache the result on `project.titleSuggestions`, return the array.
 *
 *   - mode='style'   (Generate from Your Style)
 *       LLM-only. Same as sample, but no sample anchors — the DGX side
 *       uses the style snapshot's referenceTranscripts as the few-shot
 *       corpus.
 *
 *   - mode='channel' (Generate from YouTube Channel/Video)
 *       URL-driven. Auto-detects video vs channel-page:
 *         * Video URL → set sourceUrl, transition status to 'fetching',
 *           kick `autopilot.fetchSource`. Returns { jobId, polling }
 *           so the UI polls until transcribe completes; the UI then
 *           re-invokes this endpoint with mode='sample' using the
 *           transcript-derived sample list.
 *         * Channel page → returns 501 for now (DGX-side
 *           channel-recent-video selection not yet implemented).
 *
 * Two-step pattern for channel-video mode is intentional and documented
 * here so the UI knows to (1) call this with channel/url, (2) poll
 * `/api/vater/youtube/[id]/poll`, (3) on transcribe-done call this again
 * with mode='sample' against the transcript.
 *
 * No silent catches (feedback_silent_failures_leads.md). Every failure
 * surfaces as JSON.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import { buildStyleSnapshot } from "@/lib/vater/style-snapshot";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { recordUsage } from "@/lib/vater/billing/record-usage";

type Ctx = { params: Promise<{ id: string }> };

type Mode = "sample" | "channel" | "style";

interface GenerateBody {
  mode?: Mode;
  sampleTitles?: string[];
  url?: string;
  count?: number;
}

// Detect a YouTube *video* URL: youtu.be/ID, youtube.com/watch?v=ID, or a
// bare 11-char video ID.
const VIDEO_RE =
  /(?:youtu\.be\/[\w-]{11}|youtube\.com\/watch\?[^#]*\bv=[\w-]{11}|^[\w-]{11}$)/i;

// Detect a YouTube *channel page* URL: /@handle, /channel/UC..., /c/name.
const CHANNEL_PAGE_RE = /youtube\.com\/(?:@[\w.-]+|channel\/[\w-]+|c\/[\w.-]+)/i;

function detectUrlKind(url: string): "video" | "channel-page" | "unknown" {
  if (VIDEO_RE.test(url)) return "video";
  if (CHANNEL_PAGE_RE.test(url)) return "channel-page";
  return "unknown";
}

function clampCount(raw: unknown): number {
  const n = typeof raw === "number" ? Math.floor(raw) : 5;
  if (!Number.isFinite(n) || n < 1) return 5;
  if (n > 25) return 25;
  return n;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode;
  if (mode !== "sample" && mode !== "channel" && mode !== "style") {
    return NextResponse.json(
      { error: "mode must be 'sample' | 'channel' | 'style'" },
      { status: 400 },
    );
  }

  const count = clampCount(body.count);

  // Load project + style + characters + customArtStyle so we can build a
  // snapshot for sample/style modes.
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    include: {
      style: { include: { characters: true, customArtStyle: true } },
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ── Billing gates: block BEFORE any DGX work ──────────────────────
  // channel mode kicks a fetch-source (transcription) job; the actual
  // transcription charge is recorded by the poll route once the job is
  // confirmed done. sample/style are synchronous LLM generations charged
  // here on success (action "description", 10¢).
  const budget = await checkBudget(
    session.user.id,
    mode === "channel" ? "transcription" : "description",
  );
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  // ── Mode: channel ──────────────────────────────────────────────────
  if (mode === "channel") {
    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json(
        { error: "url is required for mode='channel'" },
        { status: 400 },
      );
    }
    const kind = detectUrlKind(body.url.trim());
    if (kind === "unknown") {
      return NextResponse.json(
        { error: "Could not detect a YouTube video or channel URL" },
        { status: 400 },
      );
    }
    if (kind === "channel-page") {
      // DGX does not yet expose a channel-page → representative-video
      // pipeline. Don't fake it — return a clear 501.
      return NextResponse.json(
        {
          error:
            "channel-page mode coming soon — paste a specific video URL",
        },
        { status: 501 },
      );
    }

    // Video URL: kick fetchSource (transcribe path) and transition the
    // project state. The UI then polls /poll until transcribe finishes,
    // then re-calls this endpoint with mode='sample' on the transcript.
    let job: { jobId: string };
    try {
      job = await autopilot.fetchSource({
        projectId: project.id,
        sourceUrl: body.url.trim(),
      });
    } catch (err) {
      if (err instanceof AutopilotError) {
        console.error(
          `[vater/title/generate] project=${id} fetchSource error: ${err.message}`,
        );
        return NextResponse.json(
          {
            error: "fetch-source kickoff failed",
            detail: `[${err.status}] ${err.body || err.message}`,
          },
          { status: 502 },
        );
      }
      throw err;
    }

    const updated = await prisma.youTubeProject.update({
      where: { id },
      data: {
        sourceUrl: body.url.trim(),
        status: "fetching",
        progress: 5,
        autopilotJobId: job.jobId,
      },
    });

    console.log(
      `[vater/title/generate] project=${id} mode=channel kicked fetchSource job=${job.jobId}`,
    );

    return NextResponse.json({
      mode: "channel",
      jobId: job.jobId,
      polling: `/api/vater/youtube/${id}/poll`,
      project: updated,
    });
  }

  // ── Modes: sample | style ─────────────────────────────────────────
  // Both need a Style snapshot. v2 always lands here with a styleId
  // (created via /api/vater/youtube/new-from-style).
  if (!project.style) {
    return NextResponse.json(
      {
        error:
          "Project has no Style attached — title generation needs a Style snapshot",
      },
      { status: 409 },
    );
  }

  const styleSnapshot = buildStyleSnapshot(project.style);

  if (mode === "sample") {
    const samples = Array.isArray(body.sampleTitles)
      ? body.sampleTitles.filter((s) => typeof s === "string" && s.trim())
      : [];
    if (samples.length === 0) {
      return NextResponse.json(
        {
          error:
            "sampleTitles must be a non-empty string[] for mode='sample'",
        },
        { status: 400 },
      );
    }

    let result: { titles: string[] };
    try {
      result = await autopilot.suggestTitles({
        styleSnapshot,
        sampleTitles: samples,
        count,
      });
    } catch (err) {
      if (err instanceof AutopilotError) {
        console.error(
          `[vater/title/generate] project=${id} mode=sample autopilot error: ${err.message}`,
        );
        return NextResponse.json(
          {
            error: "suggest-titles failed",
            detail: `[${err.status}] ${err.body || err.message}`,
          },
          { status: 502 },
        );
      }
      throw err;
    }

    await prisma.youTubeProject.update({
      where: { id },
      data: {
        titleSuggestions: result.titles as Prisma.InputJsonValue,
      },
    });

    // Charge only after confirmed success. try/catch: a billing hiccup must
    // not 500 a response the user already earned (reconciler backfills).
    try {
      await recordUsage({
        userId: session.user.id,
        action: "description",
        projectId: id,
        idempotencyKey: `title_sample_${id}_${Date.now()}`,
      });
    } catch (err) {
      console.error(
        `[vater/title/generate] recordUsage failed project=${id} mode=sample`,
        err,
      );
    }

    console.log(
      `[vater/title/generate] project=${id} mode=sample titles=${result.titles.length}`,
    );

    return NextResponse.json({ mode: "sample", titles: result.titles });
  }

  // mode === 'style'
  let result: { titles: string[] };
  try {
    result = await autopilot.suggestTitles({
      styleSnapshot,
      // No sampleTitles — DGX side falls back to styleSnapshot.referenceTranscripts.
      count,
    });
  } catch (err) {
    if (err instanceof AutopilotError) {
      console.error(
        `[vater/title/generate] project=${id} mode=style autopilot error: ${err.message}`,
      );
      return NextResponse.json(
        {
          error: "suggest-titles failed",
          detail: `[${err.status}] ${err.body || err.message}`,
        },
        { status: 502 },
      );
    }
    throw err;
  }

  await prisma.youTubeProject.update({
    where: { id },
    data: {
      titleSuggestions: result.titles as Prisma.InputJsonValue,
    },
  });

  // Charge only after confirmed success. try/catch: a billing hiccup must
  // not 500 a response the user already earned (reconciler backfills).
  try {
    await recordUsage({
      userId: session.user.id,
      action: "description",
      projectId: id,
      idempotencyKey: `title_style_${id}_${Date.now()}`,
    });
  } catch (err) {
    console.error(
      `[vater/title/generate] recordUsage failed project=${id} mode=style`,
      err,
    );
  }

  console.log(
    `[vater/title/generate] project=${id} mode=style titles=${result.titles.length}`,
  );

  return NextResponse.json({ mode: "style", titles: result.titles });
}
