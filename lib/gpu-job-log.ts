/**
 * Wall-clock + cost fields persisted when a GPU job finishes.
 * costUsd is whatever Modal / the backend returns — never estimated.
 *
 * GenerateJob writes these as columns. Animate / Listing Studio fold the
 * same shape into `costJson.gpuLog` without touching billing totals.
 */

export const GPU_LOG_KEY = "gpuLog";
export const GPU_ROUTE_KEY = "gpuRoute";

export type GpuJobLogFields = {
  backend: string;
  completedAt: Date;
  durationMs: number | null;
  costUsd: number | null;
};

export type GpuRouteStamp = {
  backend: string;
  kind: string;
  reason: string;
  startedAt?: string;
};

export type GpuJobLogEntry = {
  jobId: string;
  backend: string;
  kind: string;
  durationMs: number | null;
  costUsd: number | null;
  completedAt: string;
};

function finiteUsd(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
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

/**
 * Provider-reported GPU dollars only. Reads Modal `cost_usd` first, then
 * DGX `costs.modalUsd`. Never uses list prices, ETAs, or `totalUsd`
 * (that mix includes Gemini / fal / ops).
 */
export function parseGpuCostUsd(result: unknown): number | null {
  const direct = parseModalCostUsd(result);
  if (direct != null) return direct;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const costs = (result as { costs?: unknown }).costs;
  if (costs && typeof costs === "object" && !Array.isArray(costs)) {
    const modal = finiteUsd((costs as { modalUsd?: unknown }).modalUsd);
    if (modal != null) return modal;
    return parseModalCostUsd(costs);
  }
  return null;
}

/**
 * Parse a human ETA / duration ("~5 min", "about 6 minutes", "10 seconds")
 * into seconds. Null when there is no number — never a guessed default.
 */
export function parseEtaToSeconds(label: string | null | undefined): number | null {
  if (!label || typeof label !== "string") return null;
  const m = label
    .trim()
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|min|hours?|hrs?|h)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const unit = m[2];
  if (unit.startsWith("h")) return Math.round(n * 3600);
  if (unit.startsWith("m")) return Math.round(n * 60);
  return Math.round(n);
}

/** Stamp the router decision onto costJson. Does not touch billing totals. */
export function attachGpuRoute(
  existingRaw: unknown,
  route: GpuRouteStamp,
): Record<string, unknown> {
  const next = asRecord(existingRaw);
  next[GPU_ROUTE_KEY] = {
    backend: route.backend,
    kind: route.kind,
    reason: route.reason,
    startedAt: route.startedAt ?? new Date().toISOString(),
  };
  return next;
}

export function readGpuRoute(existingRaw: unknown): GpuRouteStamp | null {
  if (!existingRaw || typeof existingRaw !== "object" || Array.isArray(existingRaw)) {
    return null;
  }
  const raw = (existingRaw as Record<string, unknown>)[GPU_ROUTE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.backend !== "string" || typeof row.kind !== "string") return null;
  return {
    backend: row.backend,
    kind: row.kind,
    reason: typeof row.reason === "string" ? row.reason : "",
    startedAt: typeof row.startedAt === "string" ? row.startedAt : undefined,
  };
}

/**
 * Append one finished-job log onto costJson.gpuLog. Idempotent per jobId.
 * Returns null when this jobId is already present (same as mergeVideoCost).
 * Never writes or rewrites totalUsd / modalUsd / byJob / byStage.
 */
export function mergeGpuJobLog(
  existingRaw: unknown,
  entry: GpuJobLogEntry,
): Record<string, unknown> | null {
  const next = asRecord(existingRaw);
  const prev = Array.isArray(next[GPU_LOG_KEY]) ? (next[GPU_LOG_KEY] as unknown[]) : [];
  const already = prev.some(
    (row) =>
      row &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      (row as { jobId?: unknown }).jobId === entry.jobId,
  );
  if (already) return null;
  next[GPU_LOG_KEY] = [
    ...prev,
    {
      jobId: entry.jobId,
      backend: entry.backend,
      kind: entry.kind,
      durationMs: entry.durationMs,
      costUsd: entry.costUsd,
      completedAt: entry.completedAt,
    },
  ];
  return next;
}

/** Billing merge (optional) + gpuLog append. Preserves existing totals. */
export function foldGpuJobLog(
  existingRaw: unknown,
  billed: Record<string, unknown> | null | undefined,
  entry: GpuJobLogEntry,
): Record<string, unknown> | null {
  const base = billed ?? existingRaw;
  return mergeGpuJobLog(base, entry) ?? billed ?? null;
}

export function gpuLogEntryFromFinish(
  jobId: string,
  kind: string,
  fields: GpuJobLogFields,
): GpuJobLogEntry {
  return {
    jobId,
    backend: fields.backend,
    kind,
    durationMs: fields.durationMs,
    costUsd: fields.costUsd,
    completedAt: fields.completedAt.toISOString(),
  };
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
    costUsd: parseGpuCostUsd(input.result),
  };
}
