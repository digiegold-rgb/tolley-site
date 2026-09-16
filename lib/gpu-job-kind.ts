/**
 * Surface-specific GPU kind + route helpers for Animate / Listing / video generate.
 * Policy stays in gpu-router.ts (no LLM, never Spark). These only pick a kind
 * and an estimatedRuntimeSec from existing product labels — never a cost guess.
 */
import {
  gpuKindForMotionEstimate,
  routeGpuJob,
  type GpuRouteDecision,
} from "./gpu-router";
import { parseEtaToSeconds } from "./gpu-job-log";

export function routeAnimateGpuJob(etaLabel: string | null | undefined): GpuRouteDecision {
  const estimatedRuntimeSec = parseEtaToSeconds(etaLabel);
  const kind = gpuKindForMotionEstimate(estimatedRuntimeSec);
  return routeGpuJob({ kind, estimatedRuntimeSec });
}

export function routeFilmProduceGpuJob(input: {
  targetDurationMin?: number | null;
  animUntilS?: number | null;
}): GpuRouteDecision {
  if (typeof input.animUntilS === "number" && input.animUntilS > 0) {
    const minutes =
      typeof input.targetDurationMin === "number" && Number.isFinite(input.targetDurationMin)
        ? input.targetDurationMin
        : 10;
    const estimatedRuntimeSec = minutes > 0 ? Math.round(minutes * 60) : null;
    const kind = gpuKindForMotionEstimate(estimatedRuntimeSec);
    return routeGpuJob({ kind, estimatedRuntimeSec });
  }
  return routeGpuJob({ kind: "still", estimatedRuntimeSec: null });
}

export function routeListingGpuJob(input: {
  skuKind: "still" | "video";
  etaLabel?: string | null;
  durationS?: number | null;
}): GpuRouteDecision {
  const gpuEta = parseEtaToSeconds(input.etaLabel);
  if (input.skuKind === "still") {
    return routeGpuJob({ kind: "still", estimatedRuntimeSec: gpuEta });
  }
  const lengthSec =
    typeof input.durationS === "number" && Number.isFinite(input.durationS) && input.durationS >= 0
      ? input.durationS
      : null;
  const kind = gpuKindForMotionEstimate(lengthSec);
  return routeGpuJob({ kind, estimatedRuntimeSec: gpuEta ?? lengthSec });
}

export function routeVideoGenerateGpuJob(tier: {
  duration: string;
  estimatedTime: string;
}): GpuRouteDecision {
  const lengthSec = parseEtaToSeconds(tier.duration);
  const gpuEta = parseEtaToSeconds(tier.estimatedTime);
  const kind = gpuKindForMotionEstimate(lengthSec ?? gpuEta);
  return routeGpuJob({ kind, estimatedRuntimeSec: gpuEta ?? lengthSec });
}

export function routeStudioGenerateGpuJob(type: "image" | "video"): GpuRouteDecision {
  const kind = type === "video" ? "short-motion" : "still";
  return routeGpuJob({ kind, estimatedRuntimeSec: null });
}
