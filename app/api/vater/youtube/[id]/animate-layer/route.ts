/**
 * GET  /api/vater/youtube/[id]/animate-layer
 * POST /api/vater/youtube/[id]/animate-layer
 *
 * Customer product: an opening Wan / i2v motion layer on a FINISHED Library
 * item. Quotes before any GPU work. Kickoff reuses the existing animate-all
 * Modal batch (same qualities, getAnimationPriceCents, checkBudget).
 *
 * Honest limit: there is no 30-second clip-length control. We animate every
 * whole scene that begins in the first 30s. See lib/vater/animate-layer.ts.
 *
 * GET  ?quality=modal-wan22-narrative
 * POST { quality?, force? }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/vater/project-access";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { rateLimited } from "@/lib/rate-limit";
import { kickoffAnimateAll } from "@/lib/vater/animate-all-kickoff";
import {
  ANIMATE_LAYER_WINDOW_S,
  animateLayerLimitCopy,
  formatAnimateLayerCoverage,
  planAnimateLayer,
  quoteAnimateLayer,
  resolveAnimateLayerQuality,
} from "@/lib/vater/animate-layer";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const FINISHED = new Set(["ready", "editing"]);

function sceneTargets(
  allScenes: SceneSpec[],
  idxs: number[],
): Parameters<typeof kickoffAnimateAll>[0]["targetScenes"] {
  const byIdx = new Map(
    allScenes.map((s, i) => {
      const idx = typeof s.idx === "number" ? s.idx : i;
      return [idx, { ...s, idx }] as const;
    }),
  );
  return idxs.flatMap((idx) => {
    const s = byIdx.get(idx);
    if (!s) return [];
    return [
      {
        sceneIdx: idx,
        animationPrompt:
          typeof s.animationPrompt === "string" ? s.animationPrompt : undefined,
        beatText: typeof s.beatText === "string" ? s.beatText : undefined,
        fixedCamera: typeof s.fixedCamera === "boolean" ? s.fixedCamera : false,
        motionIntensity:
          s.motionIntensity === "subtle" ||
          s.motionIntensity === "normal" ||
          s.motionIntensity === "bold"
            ? s.motionIntensity
            : undefined,
        holdStartPose:
          typeof s.holdStartPose === "boolean" ? s.holdStartPose : undefined,
      },
    ];
  });
}

function quotePayload(
  project: {
    id: string;
    status: string;
    autopilotJobId: string | null;
    animateAllJobId: string | null;
    animateAllStartedAt: Date | null;
    audioDuration: number | null;
    scenesJson: unknown;
  },
  quality: ReturnType<typeof resolveAnimateLayerQuality>,
  includeAnimated: boolean,
) {
  const allScenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown as SceneSpec[])
    : [];
  const plan = planAnimateLayer(allScenes, {
    windowS: ANIMATE_LAYER_WINDOW_S,
    audioDuration: project.audioDuration,
    includeAnimated,
  });
  const quote = quoteAnimateLayer(plan, quality);
  const lastBatch =
    project.animateAllJobId && project.animateAllStartedAt
      ? {
          animateAllJobId: project.animateAllJobId,
          startedAt: project.animateAllStartedAt.toISOString(),
          polling: {
            jobUrl: `/api/vater/autopilot/jobs/${project.animateAllJobId}`,
            finalizeUrl: `/api/vater/youtube/${project.id}/animate-all/finalize?animateAllJobId=${project.animateAllJobId}`,
          },
        }
      : null;
  // A stored id is not "in flight" by itself — finalize leaves the id for
  // the reconciler. The client confirms with one job poll before resuming.
  const inFlight = lastBatch;

  return {
    ok: true,
    windowS: quote.windowS,
    quality: quote.quality,
    qualityLabel: quote.qualityLabel,
    priceCentsPerClip: quote.priceCentsPerClip,
    sceneCount: quote.sceneIdxs.length,
    sceneIdxs: quote.sceneIdxs,
    coverageStartS: quote.coverageStartS,
    coverageEndS: quote.coverageEndS,
    coverageLabel: formatAnimateLayerCoverage(quote),
    timed: quote.timed,
    fallback: quote.fallback,
    skippedAnimatedCount: quote.skippedAnimatedIdxs.length,
    estimateCents: quote.estimateCents,
    estimateUsd: quote.estimateCents / 100,
    limit: animateLayerLimitCopy(quote),
    finished: FINISHED.has(project.status),
    hasWorkDir: Boolean(project.autopilotJobId),
    inFlight,
  };
}

async function loadProject(id: string) {
  return prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      autopilotJobId: true,
      animateAllJobId: true,
      animateAllStartedAt: true,
      audioDuration: true,
      scenesJson: true,
    },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const quality = resolveAnimateLayerQuality(
    req.nextUrl.searchParams.get("quality"),
  );
  const includeAnimated = req.nextUrl.searchParams.get("force") === "1";

  const project = await loadProject(id);
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(quotePayload(project, quality, includeAnimated), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    quality?: unknown;
    force?: unknown;
  };
  const quality = resolveAnimateLayerQuality(body.quality);
  const force = body.force === true;

  const project = await loadProject(id);
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!FINISHED.has(project.status)) {
    return NextResponse.json(
      {
        error:
          "Motion layer runs on a finished Library cut. Wait for this project to land in Library.",
      },
      { status: 409 },
    );
  }
  if (!project.autopilotJobId) {
    return NextResponse.json(
      { error: "Project has no autopilot job id — no work dir to animate from" },
      { status: 409 },
    );
  }

  const allScenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown as SceneSpec[])
    : [];
  const plan = planAnimateLayer(allScenes, {
    windowS: ANIMATE_LAYER_WINDOW_S,
    audioDuration: project.audioDuration,
    includeAnimated: force,
  });

  if (plan.sceneIdxs.length === 0) {
    const already = plan.skippedAnimatedIdxs.length;
    return NextResponse.json(
      {
        error: already
          ? "Opening scenes already have motion. Pass force=true to re-run the layer."
          : "No scenes fall inside the opening 30s window.",
        skippedAnimatedCount: already,
        windowS: ANIMATE_LAYER_WINDOW_S,
      },
      { status: 400 },
    );
  }

  const result = await kickoffAnimateAll({
    projectId: project.id,
    projectUserId: project.userId,
    autopilotJobId: project.autopilotJobId,
    targetScenes: sceneTargets(allScenes, plan.sceneIdxs),
    quality,
    session,
    motionModeFull: true,
  });

  if (!result.ok) {
    if (result.status === 429) {
      return rateLimited({
        allowed: false,
        count: 0,
        limit: 2,
        retryAfterSeconds:
          typeof result.body.retryAfterSeconds === "number"
            ? result.body.retryAfterSeconds
            : 1,
      });
    }
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({
    ...result,
    windowS: plan.windowS,
    coverageStartS: plan.coverageStartS,
    coverageEndS: plan.coverageEndS,
    coverageLabel: formatAnimateLayerCoverage(plan),
    limit: animateLayerLimitCopy(plan),
    estimateUsd: result.estimateCents / 100,
  });
}
