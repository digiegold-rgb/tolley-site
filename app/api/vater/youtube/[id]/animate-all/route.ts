/**
 * POST /api/vater/youtube/[id]/animate-all
 *
 * Animate every scene in a project that doesn't already have a video, using
 * the cheap-batch path: one Modal container processes all scenes sequentially
 * so the model loads once instead of N times. Saves ~70% vs per-scene.
 *
 * Body (optional):
 *   { quality?: "modal-wan22" | "modal-wan22-fast", forceAll?: boolean }
 *
 * Returns the underlying batch job — frontend polls /vater/jobs/{animateAllJobId}
 * via getJob and updates scenesJson once done.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";
import { getAnimationPriceCents } from "@/lib/vater/pricing";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";

// Just kicks off the DGX job and returns the animateAllJobId immediately.
// The frontend polls /api/vater/jobs/<id> for progress + logs.
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
  };

  // Widened 2026-04-22 for Path A/B: any of the 6 Modal batch-capable tiers.
  // Unknown quality falls back to the calm narrative default (Path A L40S).
  const VALID_BATCH_QUALITIES = [
    "modal-wan22",
    "modal-wan22-fast",
    "modal-wan22-narrative",
    "modal-wan22-narrative-fast",
    "modal-hunyuan-narrative",
    "modal-hunyuan-narrative-fast",
  ] as const;
  const quality =
    typeof body.quality === "string" &&
    (VALID_BATCH_QUALITIES as readonly string[]).includes(body.quality)
      ? (body.quality as (typeof VALID_BATCH_QUALITIES)[number])
      : "modal-wan22-narrative";
  // sceneIdxs explicit list = re-animate exactly these (forces forceAll for
  // each one). Used by the timeline multi-select.
  const explicitIdxs = Array.isArray(body.sceneIdxs)
    ? (body.sceneIdxs as unknown[])
        .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    : null;
  const forceAll = body.forceAll === true || (explicitIdxs?.length ?? 0) > 0;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      autopilotJobId: true,
      scenesJson: true,
      status: true,
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
  // If sceneIdxs given → exactly those. Else if forceAll → all. Else → any
  // scene that doesn't yet have a video.
  const targetScenes = allScenes
    .map((s, idx) => ({ ...s, idx: typeof s.idx === "number" ? s.idx : idx }))
    .filter((s) => {
      if (explicitSet) return explicitSet.has(s.idx);
      return forceAll || !s.videoUrl;
    })
    .map((s) => ({
      sceneIdx: s.idx,
      animationPrompt:
        typeof s.animationPrompt === "string" ? s.animationPrompt : undefined,
      beatText: typeof s.beatText === "string" ? s.beatText : undefined,
      fixedCamera: typeof s.fixedCamera === "boolean" ? s.fixedCamera : false,
      // Thread saved per-scene motion settings through to the batch — so
      // "Re-animate all with Hunyuan" respects each scene's Subtle/Normal/
      // Bold choice + Hold start pose toggle instead of forcing defaults.
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
      { error: "All scenes already animated. Pass forceAll=true to re-animate." },
      { status: 400 },
    );
  }

  // ── Billing gate: project the FULL batch cost before any DGX work.
  // Recording happens per-scene in /finalize, only for clips that succeeded.
  const batchCostCents = targetScenes.length * getAnimationPriceCents(quality);
  const budget = await checkBudget(
    session.user.id,
    "animation",
    quality,
    batchCostCents,
  );
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget, sceneCount: targetScenes.length },
      { status: 402 },
    );
  }
  // Trial cap is 1 animation total — a multi-scene batch can't fit in it.
  if (budget.isTrial && targetScenes.length > 1) {
    return NextResponse.json(
      {
        error:
          "Free trial includes 1 animation. Add a card to batch-animate all scenes.",
        budget: { ...budget, allow: false, reason: "trial_cap_reached" },
      },
      { status: 402 },
    );
  }

  // ── Rate limit: batch jobs are heavy — 2 per 10 minutes per user.
  const rl = await consumeRateLimit(
    `vater:animall:${session.user.id}`,
    2,
    600,
  );
  if (!rl.allowed) return rateLimited(rl);

  let kickoff;
  try {
    kickoff = await autopilot.animateAllScenes({
      jobId: project.autopilotJobId,
      scenes: targetScenes,
      quality,
    });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, upstream: err.status },
        { status: 502 },
      );
    }
    throw err;
  }

  // Persist the batch job id so the invoice-sweep reconciler can backfill
  // charges if the client never calls /finalize (tab closed after kickoff).
  // Overwrites any previous batch id — only the most recent batch is
  // reconcile-tracked; finalized batches are already billed + idempotent.
  await prisma.youTubeProject.update({
    where: { id },
    data: {
      animateAllJobId: kickoff.animateAllJobId,
      animateAllStartedAt: new Date(),
    },
  });

  // Return the animateAllJobId IMMEDIATELY. Frontend polls
  // /api/vater/jobs/<id> for progress/logs and calls
  // /api/vater/youtube/<id>/animate-all-finalize when status==done.
  return NextResponse.json({
    ok: true,
    animateAllJobId: kickoff.animateAllJobId,
    sceneCount: targetScenes.length,
    polling: {
      jobUrl: `/api/vater/autopilot/jobs/${kickoff.animateAllJobId}`,
      finalizeUrl: `/api/vater/youtube/${id}/animate-all/finalize?animateAllJobId=${kickoff.animateAllJobId}`,
    },
  });
}
