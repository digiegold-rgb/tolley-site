/**
 * Wall-clock + cost fields persisted on GenerateJob when a GPU job finishes.
 * costUsd is whatever Modal (or a future backend) returns — never estimated.
 */

export type GpuJobLogFields = {
  backend: string;
  completedAt: Date;
  durationMs: number | null;
  costUsd: number | null;
};

function finiteUsd(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Pull a dollar amount from a Modal function result / usage blob, or null. */
export function parseModalCostUsd(result: unknown): number | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const row = result as Record<string, unknown>;
  const direct =
    finiteUsd(row.cost_usd) ??
    finiteUsd(row.costUsd) ??
    finiteUsd(row.cost);
  if (direct != null) return direct;
  const usage = row.usage;
  if (usage && typeof usage === "object" && !Array.isArray(usage)) {
    const u = usage as Record<string, unknown>;
    return finiteUsd(u.cost_usd) ?? finiteUsd(u.costUsd) ?? finiteUsd(u.cost);
  }
  return null;
}

export function durationMsBetween(startedAt: Date | null | undefined, completedAt: Date): number | null {
  if (!startedAt) return null;
  const ms = completedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.trunc(ms);
}

export function gpuJobFinishFields(input: {
  startedAt?: Date | null;
  completedAt?: Date;
  result?: unknown;
  backend?: string | null;
}): GpuJobLogFields {
  const completedAt = input.completedAt ?? new Date();
  const backend = (input.backend || "").trim() || "modal";
  return {
    backend,
    completedAt,
    durationMs: durationMsBetween(input.startedAt, completedAt),
    costUsd: parseModalCostUsd(input.result),
  };
}
