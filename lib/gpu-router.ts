/**
 * GPU job router v1 — Modal vs Nebius policy stub.
 *
 * Pure rules, no LLM. Spark is never a backend (ops-only, not scalable).
 * Callers still only spawn Modal; the Nebius path throws until a client exists.
 */

export const GPU_JOB_KINDS = ["still", "short-motion", "long-video", "batch"] as const;
export type GpuJobKind = (typeof GPU_JOB_KINDS)[number];

export const GPU_BACKENDS = ["modal", "nebius"] as const;
export type GpuBackend = (typeof GPU_BACKENDS)[number];

/** Long jobs (20 minutes or more) go to Nebius once that path is wired. */
export const NEBIUS_RUNTIME_SEC = 20 * 60;

export const NEBIUS_NOT_WIRED =
  "Nebius GPU backend is not wired yet. Callers still spawn Modal only.";

export type GpuRouteInput = {
  estimatedRuntimeSec?: number | null;
  kind: GpuJobKind;
  /** Accepted for future tuning. Unused in v1 rules. */
  queueDepth?: number | null;
};

export type GpuRouteDecision = {
  backend: GpuBackend;
  reason: string;
};

export function isGpuJobKind(value: unknown): value is GpuJobKind {
  return typeof value === "string" && (GPU_JOB_KINDS as readonly string[]).includes(value);
}

function finiteNonNegativeSec(value: number | null | undefined): number | null {
  if (value == null || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Choose Modal (short) or Nebius (long). Never Spark.
 *
 * Nebius when estimated runtime ≥ 20 minutes OR kind is long-video / batch.
 * Everything else → Modal. queueDepth is ignored in v1.
 */
export function routeGpuJob(input: GpuRouteInput): GpuRouteDecision {
  const kind = isGpuJobKind(input.kind) ? input.kind : "still";
  const estimated = finiteNonNegativeSec(input.estimatedRuntimeSec);

  if (kind === "long-video") {
    return {
      backend: "nebius",
      reason: "kind is long-video — reserved for Nebius (not wired)",
    };
  }
  if (kind === "batch") {
    return {
      backend: "nebius",
      reason: "kind is batch — reserved for Nebius (not wired)",
    };
  }
  if (estimated != null && estimated >= NEBIUS_RUNTIME_SEC) {
    return {
      backend: "nebius",
      reason: `estimated runtime ${estimated}s ≥ ${NEBIUS_RUNTIME_SEC}s — reserved for Nebius (not wired)`,
    };
  }

  const runtimeNote =
    estimated == null ? "no runtime estimate" : `estimated runtime ${estimated}s < ${NEBIUS_RUNTIME_SEC}s`;
  return {
    backend: "modal",
    reason: `kind is ${kind}, ${runtimeNote} — Modal short path`,
  };
}

/** Stills / short-motion callers still only spawn Modal. */
export function requireWiredGpuBackend(
  decision: GpuRouteDecision,
): asserts decision is { backend: "modal"; reason: string } {
  if (decision.backend === "nebius") {
    console.warn(`[gpu-router] ${NEBIUS_NOT_WIRED} (${decision.reason})`);
    throw new Error(`${NEBIUS_NOT_WIRED} (${decision.reason})`);
  }
  if (decision.backend !== "modal") {
    throw new Error(`Unknown GPU backend "${String(decision.backend)}". Spark is not a GPU backend.`);
  }
}
