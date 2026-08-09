// Per-video real generation cost (YouTubeProject.costJson), pushed by the
// DGX on job completion. Real cash only — Claude tokens are tracked
// separately at $0 by convention (Jared 2026-08-06).

export interface VideoCostStage {
  usd: number;
  calls?: number;
  estimated?: boolean;
  detail?: string;
}

export interface VideoCostJson {
  totalUsd?: number;
  modalUsd?: number;
  geminiUsd?: number;
  falUsd?: number;
  otherUsd?: number;
  llmUsd?: number;
  estimated?: boolean;
  byStage?: Record<string, VideoCostStage>;
  // Per-job contributions already folded into the totals above. Keyed by
  // DGX job id — the merge idempotency ledger, so re-polls of a done job
  // can't double-count it.
  byJob?: Record<string, number>;
  updatedAt?: string;
}

export function parseVideoCost(raw: unknown): VideoCostJson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as VideoCostJson;
  const total =
    typeof c.totalUsd === "number"
      ? c.totalUsd
      : (c.modalUsd ?? 0) + (c.geminiUsd ?? 0) + (c.falUsd ?? 0) + (c.otherUsd ?? 0);
  if (!Number.isFinite(total)) return null;
  return { ...c, totalUsd: total };
}

export function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Fold one finished job's costs into a video's cumulative costJson so the
 * library card shows total production cost across every part — the full
 * render plus later editor revision passes (regen / animate-all).
 * Idempotent per jobId via byJob: re-polls and finalize retries return
 * null instead of double-counting. Returns null when there is nothing new
 * to persist.
 */
export function mergeVideoCost(
  existingRaw: unknown,
  incomingRaw: unknown,
  jobId: string,
): VideoCostJson | null {
  const incoming = parseVideoCost(incomingRaw);
  if (!incoming || !((incoming.totalUsd ?? 0) > 0)) return null;
  const existing = parseVideoCost(existingRaw);
  if (!existing) {
    return { ...incoming, byJob: { [jobId]: round4(incoming.totalUsd ?? 0) } };
  }
  if (existing.byJob?.[jobId] !== undefined) return null;

  const byStage: Record<string, VideoCostStage> = { ...(existing.byStage ?? {}) };
  for (const [k, v] of Object.entries(incoming.byStage ?? {})) {
    const prev = byStage[k];
    byStage[k] = prev
      ? {
          ...v,
          usd: round4((prev.usd ?? 0) + (v.usd ?? 0)),
          calls: (prev.calls ?? 0) + (v.calls ?? 0),
        }
      : v;
  }
  return {
    ...existing,
    totalUsd: round4((existing.totalUsd ?? 0) + (incoming.totalUsd ?? 0)),
    modalUsd: round4((existing.modalUsd ?? 0) + (incoming.modalUsd ?? 0)),
    geminiUsd: round4((existing.geminiUsd ?? 0) + (incoming.geminiUsd ?? 0)),
    falUsd: round4((existing.falUsd ?? 0) + (incoming.falUsd ?? 0)),
    otherUsd: round4((existing.otherUsd ?? 0) + (incoming.otherUsd ?? 0)),
    llmUsd: round4((existing.llmUsd ?? 0) + (incoming.llmUsd ?? 0)),
    estimated: Boolean(existing.estimated || incoming.estimated),
    byStage,
    byJob: { ...(existing.byJob ?? {}), [jobId]: round4(incoming.totalUsd ?? 0) },
    updatedAt: incoming.updatedAt ?? new Date().toISOString(),
  };
}

/** Non-zero provider rows for breakdown UIs, largest first. */
export function costProviderRows(c: VideoCostJson): { label: string; usd: number }[] {
  const rows: { label: string; usd: number }[] = [
    { label: "Modal GPU", usd: c.modalUsd ?? 0 },
    { label: "Gemini", usd: c.geminiUsd ?? 0 },
    { label: "fal.ai", usd: c.falUsd ?? 0 },
    { label: "Other (LLM etc.)", usd: c.otherUsd ?? 0 },
  ].filter((r) => r.usd > 0);
  return rows.sort((a, b) => b.usd - a.usd);
}

// ── Billed price = "Compute (at cost)" + "Render Operations" ──────────────
// Compute is the pass-through spend above. Render Operations is
// finished_video_minutes x OPS_RATE (the margin). The rate is config, not
// code (VATER_OPS_RATE_PER_MIN in VATER-SETTINGS.env) — server routes read it
// via lib/vater/billing/ops-fee.ts and hand it to the client, so changing the
// rate never needs a deploy and never touches the compute calculation.

/** Fallback used only when a client renders before the rate has loaded. */
export const DEFAULT_OPS_RATE_PER_MIN = 1.0;

export interface VideoBilling {
  minutes: number;
  computeUsd: number;
  opsUsd: number;
  totalUsd: number;
  effectiveUsdPerMinute: number;
}

/** Billed price for one finished video. `computeUsd` is passed through
 *  untouched — this only adds the operations line on top. */
export function buildVideoBilling(
  computeUsd: number,
  durationSeconds: number | null | undefined,
  opsRatePerMinute: number = DEFAULT_OPS_RATE_PER_MIN,
): VideoBilling {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const minutes = Math.max(0, Number(durationSeconds) || 0) / 60;
  const compute = r2(computeUsd || 0);
  const ops = r2(minutes * opsRatePerMinute);
  const total = r2(compute + ops);
  return {
    minutes: Math.round(minutes * 100) / 100,
    computeUsd: compute,
    opsUsd: ops,
    totalUsd: total,
    effectiveUsdPerMinute: minutes > 0 ? r2(total / minutes) : 0,
  };
}
