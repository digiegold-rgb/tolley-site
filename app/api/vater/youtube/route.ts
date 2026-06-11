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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.youTubeProject.findMany({
    where: scopedProjectWhere(session.user.id, session.user.email),
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

const URL_RE = /^https?:\/\/.+\..+/;

interface CreateBody {
  url?: string;
  rssItemId?: string;
  targetDuration?: number;
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
      select: { id: true, url: true, title: true, project: { select: { id: true } } },
    });
    if (!item) {
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
