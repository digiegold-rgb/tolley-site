/**
 * Shared Wan / i2v batch kickoff. Used by POST /animate-all and the
 * Library "motion layer" route so both hit the same Modal path, prices,
 * budget gate, and rate limit — no second GPU product.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { attachGpuRoute } from "@/lib/gpu-job-log";
import { routeAnimateGpuJob } from "@/lib/gpu-job-kind";
import { requireWiredGpuBackend } from "@/lib/gpu-router";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { getAnimationPrice, getAnimationPriceCents } from "@/lib/vater/pricing";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";
import type { AnimateLayerQuality } from "@/lib/vater/animate-layer";
import type { Prisma } from "@prisma/client";

export type AnimateAllTarget = {
  sceneIdx: number;
  /** Exact still version to animate (0 = base). */
  imageVersion?: number;
  motionSheet?: unknown;
  animationPrompt?: string;
  beatText?: string;
  fixedCamera: boolean;
  motionIntensity?: "subtle" | "normal" | "bold";
  holdStartPose?: boolean;
  /** modal-animate2 only: pin one driver clip for this scene. */
  driverId?: string;
};

export type AnimateAllKickoffOk = {
  ok: true;
  animateAllJobId: string;
  sceneCount: number;
  quality: AnimateLayerQuality;
  estimateCents: number;
  polling: {
    jobUrl: string;
    finalizeUrl: string;
  };
};

export type AnimateAllKickoffErr = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

export async function kickoffAnimateAll(input: {
  projectId: string;
  projectUserId: string | null;
  autopilotJobId: string;
  targetScenes: AnimateAllTarget[];
  quality: AnimateLayerQuality;
  session: { user?: { id?: string | null; email?: string | null } | null };
  /** Flip motionMode to full so later estimates match what was bought. */
  motionModeFull?: boolean;
}): Promise<AnimateAllKickoffOk | AnimateAllKickoffErr> {
  const userId = input.session.user?.id;
  if (!userId) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  if (input.targetScenes.length === 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error:
          "All scenes already animated. Pass force=true to re-animate the opening window.",
      },
    };
  }

  const batchCostCents =
    input.targetScenes.length * getAnimationPriceCents(input.quality);
  const budget = await checkBudget(
    userId,
    "animation",
    input.quality,
    batchCostCents,
  );
  if (!budget.allow) {
    return {
      ok: false,
      status: 402,
      body: {
        error: "Billing check failed",
        budget,
        sceneCount: input.targetScenes.length,
      },
    };
  }
  if (budget.isTrial && input.targetScenes.length > 1) {
    return {
      ok: false,
      status: 402,
      body: {
        error:
          "Free trial includes 1 animation. Add a card to batch-animate all scenes.",
        budget: { ...budget, allow: false, reason: "trial_cap_reached" },
      },
    };
  }

  const rl = await consumeRateLimit(`vater:animall:${userId}`, 2, 600);
  if (!rl.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "Rate limited",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
    };
  }

  const gpuRoute = routeAnimateGpuJob(getAnimationPrice(input.quality)?.etaLabel);
  try {
    requireWiredGpuBackend(gpuRoute);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 501,
      body: { error: message, gpu_route: gpuRoute },
    };
  }

  let kickoff;
  try {
    const { ownerId, ownerTier, ownerLane } =
      await ownerFieldsForSessionWithLane(input.session, input.projectUserId);
    kickoff = await autopilot.animateAllScenes({
      jobId: input.autopilotJobId,
      scenes: input.targetScenes,
      quality: input.quality,
      ownerId,
      ownerTier,
      ownerLane,
    });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return {
        ok: false,
        status: 502,
        body: { error: err.message, upstream: err.status },
      };
    }
    throw err;
  }

  const existing = await prisma.youTubeProject.findUnique({
    where: { id: input.projectId },
    select: { settingsJson: true, costJson: true },
  });
  const currentSettings =
    existing?.settingsJson &&
    typeof existing.settingsJson === "object" &&
    !Array.isArray(existing.settingsJson)
      ? (existing.settingsJson as Record<string, unknown>)
      : {};

  await prisma.youTubeProject.update({
    where: { id: input.projectId },
    data: {
      animateAllJobId: kickoff.animateAllJobId,
      animateAllStartedAt: new Date(),
      costJson: attachGpuRoute(existing?.costJson, {
        backend: gpuRoute.backend,
        kind: gpuRoute.kind,
        reason: gpuRoute.reason,
      }) as Prisma.InputJsonValue,
      ...(input.motionModeFull
        ? { settingsJson: { ...currentSettings, motionMode: "full" } }
        : {}),
    },
  });

  return {
    ok: true,
    animateAllJobId: kickoff.animateAllJobId,
    sceneCount: input.targetScenes.length,
    quality: input.quality,
    estimateCents: batchCostCents,
    polling: {
      jobUrl: `/api/vater/autopilot/jobs/${kickoff.animateAllJobId}`,
      finalizeUrl: `/api/vater/youtube/${input.projectId}/animate-all/finalize?animateAllJobId=${kickoff.animateAllJobId}`,
    },
  };
}
