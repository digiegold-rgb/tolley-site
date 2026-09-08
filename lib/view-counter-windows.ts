import { DAY_MS, staleMetric, type ActivityWindow } from "./posts-accuracy";

export type WindowStat = ActivityWindow;
export const VIEW_WINDOWS = [30, 90, 365] as const;
export interface ViewStatRowLike {
  id: string; day: Date; totalViews: bigint | number | null;
  dayViews: number | null; subscribers: number | null; pulledAt: Date;
}
export interface VideoStatRowLike {
  videoId: string; title: string; publishedAt: Date;
  views: bigint | number; pulledAt: Date;
}
export interface WindowChannelConfig {
  platform: string; contentSince?: string; rowsSince?: string;
}
export interface ChannelWindowsResult<R extends ViewStatRowLike, V extends VideoStatRowLike> {
  hist: R[]; snaps: R[]; dailies: R[]; subs: R[]; latestSnap: R | null;
  lifetimeViews: number | null; contentSinceMs: number | null;
  allVids: V[]; windows: Record<string, WindowStat>;
}
/** Historical rows can be touched by backfills of a different metric.
 * Never describe their old counter as newer than the day it represents. */
export function metricObservedAt(row: { day: Date; pulledAt: Date }, now: number) {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  return new Date(Math.min(row.pulledAt.getTime(), row.day.getTime() < today ? row.day.getTime() + DAY_MS - 1 : now));
}
/** Daily reports use complete UTC dates. Snapshot changes are explicitly
 * approximate and never mixed with lifetime views on an upload cohort. */
export function channelWindows<R extends ViewStatRowLike, V extends VideoStatRowLike>(
  rows: R[], vidRows: V[], cfg: WindowChannelConfig,
  now = Date.now(), windowDays: readonly number[] = VIEW_WINDOWS,
): ChannelWindowsResult<R, V> {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const clamp = cfg.rowsSince ? Date.parse(cfg.rowsSince) : null;
  const hist = rows.filter(r => (!clamp || r.day.getTime() >= clamp) && r.day.getTime() <= today).sort((a,b) => +a.day - +b.day);
  const snaps = hist.filter(r => r.totalViews !== null);
  const dailies = hist.filter(r => r.dayViews !== null && +r.day < today);
  const subs = hist.filter(r => r.subscribers !== null);
  const latestSnap = snaps.at(-1) ?? null;
  const lifetimeViews = latestSnap ? Number(latestSnap.totalViews) : dailies.length ? dailies.reduce((s,r) => s + (r.dayViews ?? 0),0) : null;
  const contentSinceMs = cfg.contentSince ? Date.parse(cfg.contentSince) : null;
  const allVids = vidRows.filter(v => (!clamp || +v.publishedAt >= clamp) && +v.publishedAt <= now).sort((a,b) => +b.publishedAt - +a.publishedAt);
  const windows: Record<string, WindowStat> = {};
  for (const days of windowDays) {
    const start = today - days * DAY_MS;
    const inWindow = dailies.filter(r => +r.day >= start);
    if (cfg.platform === "x") {
      windows[`d${days}`] = { views: null, partial: true, since: null, through: null, asOf: null, stale: true, method: "unavailable",
        reason: "X supplies sampled lifetime tweet counts. Date-window activity cannot be reconstructed from changing timeline samples." };
      continue;
    }
    // Facebook's page-video daily series has a different scope from reel
    // counters. Keep it out of the comparable activity series.
    if (cfg.platform !== "facebook" && inWindow.length) {
      const first = inWindow[0], last = inWindow.at(-1)!;
      const observed = metricObservedAt(last, now);
      const weekly = cfg.platform === "linkedin";
      const stale = staleMetric(observed, now, (weekly ? 10 : cfg.platform === "youtube" ? 4 : 2) * DAY_MS);
      const distinctDays = new Set(inWindow.map(r => r.day.toISOString().slice(0,10))).size;
      windows[`d${days}`] = {
        views: inWindow.reduce((s,r) => s + (r.dayViews ?? 0),0),
        partial: stale || distinctDays !== days || weekly,
        since: first.day.toISOString().slice(0,10), through: last.day.toISOString().slice(0,10),
        asOf: observed.toISOString(), stale, method: "daily",
        reason: weekly ? "Weekly impression digests; incomplete daily coverage." : distinctDays !== days ? `${distinctDays} of ${days} UTC dates reported; missing days are unknown.` : null,
      };
      continue;
    }
    const baseline = snaps.filter(r => +r.day <= start && +r.day >= start - DAY_MS).at(-1)
      ?? snaps.find(r => +r.day >= start);
    if (latestSnap && ((baseline && baseline.id !== latestSnap.id) || (contentSinceMs && contentSinceMs >= start))) {
      const startsWithChannel = !!contentSinceMs && contentSinceMs >= start;
      const old = startsWithChannel ? 0 : Number(baseline!.totalViews);
      const delta = Number(latestSnap.totalViews) - old;
      const observed = metricObservedAt(latestSnap, now);
      const stale = staleMetric(observed, now);
      windows[`d${days}`] = {
        views: delta < 0 ? null : delta, method: delta < 0 ? "unavailable" : "counter-change",
        partial: stale || delta < 0 || (!startsWithChannel && +baseline!.day !== start) || +latestSnap.day !== today,
        since: new Date(startsWithChannel ? contentSinceMs! : +baseline!.day).toISOString().slice(0,10),
        through: latestSnap.day.toISOString().slice(0,10), asOf: observed.toISOString(), stale,
        reason: delta < 0 ? "Counter decreased; views cannot be reconstructed from these snapshots." : "Net counter change; deletions and corrections can affect this estimate.",
      };
      continue;
    }
    windows[`d${days}`] = { views: null, partial: true, since: null, through: null, asOf: null, stale: true, method: "unavailable",
      reason: "No comparable activity history for this period. Upload lifetime counts are shown separately." };
  }
  return { hist, snaps, dailies, subs, latestSnap, lifetimeViews, contentSinceMs, allVids, windows };
}
export function groupByChannel<T extends { channelKey: string }>(rows: T[]): Map<string,T[]> {
  const result = new Map<string,T[]>();
  for (const row of rows) { const list = result.get(row.channelKey) ?? []; list.push(row); result.set(row.channelKey,list); }
  return result;
}
