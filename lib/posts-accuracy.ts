/** Pure reporting rules. Unknown data must not become a known zero. */
export const DAY_MS = 86_400_000;
export const METRIC_MAX_AGE_MS = 36 * 3_600_000;

export function staleMetric(asOf: Date | string | null | undefined, now = Date.now(), maxAge = METRIC_MAX_AGE_MS) {
  const at = asOf ? new Date(asOf).getTime() : NaN;
  return !Number.isFinite(at) || at > now + 300_000 || now - at > maxAge;
}

export interface ActivityWindow {
  views: number | null;
  partial: boolean;
  since: string | null;
  through?: string | null;
  asOf?: string | null;
  stale?: boolean;
  method?: "daily" | "counter-change" | "unavailable";
  reason?: string | null;
}

export function activityTotal(windows: ActivityWindow[]) {
  const included = windows.filter(w => w.views !== null && !w.stale && w.method !== "unavailable");
  return {
    views: included.length ? included.reduce((s, w) => s + w.views!, 0) : null,
    partial: included.length !== windows.length || included.some(w => w.partial),
    included: included.length,
    excluded: windows.length - included.length,
    approximate: included.some(w => w.method === "counter-change"),
  };
}

export type PostIdentity = {
  runId: string; job: string; channel: string; account?: string | null;
  business?: string | null; status: string; url?: string | null;
  videoKey?: string | null; title?: string | null; error?: string | null;
  firedAt?: Date | string | null; costCents?: number;
};

export function postIdentity(row: PostIdentity) {
  return JSON.stringify([
    row.job, row.runId, row.channel, row.account ?? null, row.business ?? null,
    row.status, row.url ?? null, row.videoKey ?? null, row.title ?? null,
    row.error ?? null, row.firedAt ? new Date(row.firedAt).toISOString() : null,
    row.costCents ?? 0,
  ]);
}

export function uniquePostRows<T extends PostIdentity>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = postIdentity(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
