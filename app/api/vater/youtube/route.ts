import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wordCountForDuration } from "@/lib/vater/youtube-types";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import { auth } from "@/auth";
import { scopedProjectWhere } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { extractYouTubeVideoId } from "@/lib/vater/video-id";
import { ensureVideoNumbers } from "@/lib/vater/video-number";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Course segments (projectType "course-segment") are chapter renders owned
  // by a CourseLesson — they never appear in the YouTube lane. The cost pill
  // in /api/vater/latest deliberately stays all-in across both lanes.
  const projects = await prisma.youTubeProject.findMany({
    where: {
      AND: [
        scopedProjectWhere(session.user.id, session.user.email),
        { projectType: "youtube" },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  // Lazy per-owner "#N — " numbering (Trey 2026-08-12) — covers every
  // creation path, including headless DGX scripts that bypass these routes.
  await ensureVideoNumbers(projects);

  return NextResponse.json({ projects });
}

const URL_RE = /^https?:\/\/.+\..+/;

interface CreateBody {
  url?: string;
  rssItemId?: string;
  targetDuration?: number;
  // Script Review intake (2026-08-08) — all optional, legacy callers unaffected.
  // Set here rather than PATCHed afterwards so the row is complete before the
  // transcript lands and the Script Review screen auto-continues to scripting.
  styleId?: string;
  voiceName?: string;
  goal?: string;
  /** Animate the first N seconds, Ken Burns the remainder. */
  animUntilS?: number;
  /** Set true to bypass the reused-reference warning (409) and proceed. */
  allowReusedSource?: boolean;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve source: either an RSS item we already discovered, or a manual URL.
  let sourceUrl: string | null = null;
  let sourceTitle: string | null = null;
  let sourceType: "manual" | "rss" = "manual";
  let rssItemId: string | null = null;

  if (body.rssItemId) {
    const item = await prisma.vaterRssItem.findUnique({
      where: { id: body.rssItemId },
      select: {
        id: true,
        url: true,
        title: true,
        project: { select: { id: true } },
        feed: { select: { userId: true } },
      },
    });
    // Feeds are per-user (2026-08-17): an item is only promotable by the user
    // who follows the feed. A NULL owner must FAIL CLOSED — treating it as
    // "unowned, so anyone may take it" would let any signed-in /animate user
    // promote it. The rest of the RSS surface (app/api/vater/rss/*) already
    // scopes hard on `userId: session.user.id`, so a NULL-owner feed is
    // invisible there; this route now matches.
    if (!item || item.feed.userId !== session.user.id) {
      return NextResponse.json({ error: "RSS item not found" }, { status: 404 });
    }
    if (item.project) {
      return NextResponse.json(
        { error: "RSS item already promoted", projectId: item.project.id },
        { status: 409 },
      );
    }
    sourceUrl = item.url;
    sourceTitle = item.title;
    sourceType = "rss";
    rssItemId = item.id;
  } else {
    if (!body.url || !URL_RE.test(body.url)) {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 },
      );
    }
    sourceUrl = body.url;
  }

  if (!sourceUrl) {
    return NextResponse.json({ error: "No source resolved" }, { status: 400 });
  }

  // ── Reused-reference warning (2026-08-09, Trey's request) ──────────────
  // If this reference video was already used — as the source of an earlier
  // project or as a style reference — warn instead of silently making a
  // near-duplicate. The client re-submits with `allowReusedSource: true`
  // to bypass after showing the warning.
  if (!body.allowReusedSource) {
    const videoId = extractYouTubeVideoId(sourceUrl);
    const priorUses: Array<{
      kind: "project" | "style";
      id: string;
      title: string;
      status?: string;
      usedAt?: string;
    }> = [];

    const priorProjects = await prisma.youTubeProject.findMany({
      where: {
        ...scopedProjectWhere(session.user.id, session.user.email),
        sourceUrl: videoId ? { contains: videoId } : sourceUrl,
      },
      select: {
        id: true,
        sourceTitle: true,
        topic: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    for (const p of priorProjects) {
      priorUses.push({
        kind: "project",
        id: p.id,
        title: p.sourceTitle ?? p.topic ?? "(untitled project)",
        status: p.status,
        usedAt: p.createdAt.toISOString(),
      });
    }

    // Style references live in a JSON column — the per-user style count is
    // small, so scan in JS rather than fighting Prisma JSON filters.
    const styles = await prisma.youTubeStyle.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, referenceTranscripts: true },
    });
    for (const s of styles) {
      const refs = Array.isArray(s.referenceTranscripts)
        ? (s.referenceTranscripts as Array<{ videoId?: string; url?: string }>)
        : [];
      const hit = refs.some(
        (r) =>
          (videoId && r?.videoId === videoId) ||
          (r?.url && r.url === sourceUrl),
      );
      if (hit) {
        priorUses.push({ kind: "style", id: s.id, title: s.name });
      }
    }

    if (priorUses.length > 0) {
      return NextResponse.json(
        { error: "reference_already_used", priorUses },
        { status: 409 },
      );
    }
  }

  // Billing gate: transcribe-mode creation kicks off a transcription on the
  // DGX immediately. The charge itself lands in the poll route on completion
  // (transcription_${jobId}) — this pre-check blocks capped trial users and
  // delinquent cards BEFORE any DGX work starts.
  const budget = await checkBudget(session.user.id, "transcription");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  const duration =
    typeof body.targetDuration === "number" && body.targetDuration > 0
      ? Math.min(30, Math.max(1, Math.round(body.targetDuration)))
      : 10;

  // Optional style — must exist and be system-owned or ours (same rule as
  // /new-from-style). A bad id is a 400/403/404, never a silently styleless
  // project the user then has to debug at render time.
  let styleId: string | null = null;
  if (body.styleId !== undefined) {
    if (typeof body.styleId !== "string" || !body.styleId.trim()) {
      return NextResponse.json({ error: "Invalid styleId" }, { status: 400 });
    }
    const style = await prisma.youTubeStyle.findUnique({
      where: { id: body.styleId },
      select: { id: true, userId: true, isSystem: true },
    });
    if (!style) {
      return NextResponse.json({ error: "Style not found" }, { status: 404 });
    }
    if (!style.isSystem && style.userId && style.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    styleId = style.id;
  }

  const animUntilS =
    typeof body.animUntilS === "number" && body.animUntilS > 0
      ? Math.round(body.animUntilS)
      : null;

  const project = await prisma.youTubeProject.create({
    data: {
      userId: session.user.id,
      mode: "transcribe",
      sourceUrl,
      sourceTitle,
      sourceType,
      rssItemId,
      targetDuration: duration,
      targetWordCount: wordCountForDuration(duration),
      status: "fetching",
      progress: 5,
      styleId,
      animUntilS,
      voiceName:
        typeof body.voiceName === "string" && body.voiceName.trim()
          ? body.voiceName.trim()
          : null,
      goal:
        typeof body.goal === "string" && body.goal.trim()
          ? body.goal.trim()
          : null,
    },
  });

  try {
    const job = await autopilot.fetchSource({
      projectId: project.id,
      sourceUrl,
    });
    const withJob = await prisma.youTubeProject.update({
      where: { id: project.id },
      data: { autopilotJobId: job.jobId },
    });
    return NextResponse.json({ project: withJob }, { status: 201 });
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    const failed = await prisma.youTubeProject.update({
      where: { id: project.id },
      data: {
        status: "failed",
        errorMessage: `fetch-source kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return NextResponse.json(
      { error: "fetch-source kickoff failed", detail, project: failed },
      { status: 502 },
    );
  }
}
