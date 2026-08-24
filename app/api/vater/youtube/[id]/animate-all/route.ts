/**
 * POST /api/vater/youtube/[id]/animate-all
 *
 * Animate every scene in a project that doesn't already have a video, using
 * the cheap-batch path: one Modal container processes all scenes sequentially
 * so the model loads once instead of N times. Saves ~70% vs per-scene.
 *
 * Body (optional):
 *   { quality?: "modal-wan22" | "modal-wan22-fast" | ...,
 *     forceAll?: boolean,
 *     sceneIdxs?: number[],
 *     untilS?: number }
 *
 * `untilS` is the opening-window filter used by the Library motion layer:
 * only scenes that BEGIN before that second are batched. Whole scenes, not
 * a sliced clip.
 *
 * Returns the underlying batch job — frontend polls /vater/jobs/{animateAllJobId}
 * via getJob and updates scenesJson once done.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";
import { rateLimited } from "@/lib/rate-limit";
import { kickoffAnimateAll } from "@/lib/vater/animate-all-kickoff";
import {
  planAnimateLayer,
  resolveAnimateLayerQuality,
} from "@/lib/vater/animate-layer";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    quality?: unknown;
    forceAll?: unknown;
    sceneIdxs?: unknown;
    untilS?: unknown;
  };

  const quality = resolveAnimateLayerQuality(body.quality);
  const explicitIdxs = Array.isArray(body.sceneIdxs)
    ? (body.sceneIdxs as unknown[]).filter(
        (x): x is number => typeof x === "number" && Number.isFinite(x),
      )
    : null;
  const forceAll = body.forceAll === true || (explicitIdxs?.length ?? 0) > 0;
  const untilS =
    typeof body.untilS === "number" && Number.isFinite(body.untilS) && body.untilS > 0
      ? body.untilS
      : null;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      autopilotJobId: true,
      scenesJson: true,
      status: true,
      audioDuration: true,
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
  const explicitSet = explicitIdxs ? new Set(explicitIdxs) : null;
  const windowIdxs =
    untilS && !explicitSet
      ? new Set(
          planAnimateLayer(allScenes, {
            windowS: untilS,
            audioDuration: project.audioDuration,
            includeAnimated: forceAll,
          }).sceneIdxs,
        )
      : null;

  const targetScenes = allScenes
    .map((s, idx) => ({ ...s, idx: typeof s.idx === "number" ? s.idx : idx }))
    .filter((s) => {
      if (explicitSet) return explicitSet.has(s.idx);
      if (windowIdxs) return windowIdxs.has(s.idx);
      return forceAll || !s.videoUrl;
    })
    .map((s) => ({
      sceneIdx: s.idx,
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
    }));

  if (targetScenes.length === 0) {
    return NextResponse.json(
      {
        error: untilS
          ? "No scenes in that opening window. Pass forceAll=true to re-animate."
          : "All scenes already animated. Pass forceAll=true to re-animate.",
      },
      { status: 400 },
    );
  }

  const result = await kickoffAnimateAll({
    projectId: project.id,
    projectUserId: project.userId,
    autopilotJobId: project.autopilotJobId,
    targetScenes,
    quality,
    session,
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
    ok: true,
    animateAllJobId: result.animateAllJobId,
    sceneCount: result.sceneCount,
    polling: result.polling,
  });
}
