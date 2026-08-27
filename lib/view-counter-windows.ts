/**
 * lib/view-counter-windows.ts — pure window math for the view counter.
 *
 * Extracted verbatim from app/api/hq/view-counter/route.ts (2026-08-27) so
 * the Listing Studio landing page can show Jared's REAL 30-day views
 * (lib/vater/listing/proof-stats.ts) from the same numbers /hq shows —
 * never a hardcoded figure. No prisma, no next imports: rows in, windows out.
 *
 * Window math prefers the exact method available per platform: cumulative
 * deltas for YouTube (lifetime counter snapshots), summed per-reel views for
 * Facebook (Meta's page_video_views omits Reels-feed distribution and reads
 * 4-6x low — measured 2026-08-17). See lib/view-counter.ts for the
 * contentSince rule that makes brand-new channels show full numbers on day one.
 */

export interface WindowStat {
  views: number | null;
  /** true when history doesn't reach the window start */
  partial: boolean;
  /** where coverage actually begins, when partial */
  since: string | null;
}

export const VIEW_WINDOWS = [30, 90, 365] as const;

/** ChannelViewStat row (the subset the math needs). */
export interface ViewStatRowLike {
  id: string;
  day: Date;
  totalViews: bigint | number | null;
  dayViews: number | null;
  subscribers: number | null;
  pulledAt: Date;
}

/** ChannelVideoStat row (the subset the math needs). */
export interface VideoStatRowLike {
  videoId: string;
  title: string;
  publishedAt: Date;
  views: bigint | number;
  pulledAt: Date;
}

export interface WindowChannelConfig {
  platform: string;
  contentSince?: string;
  rowsSince?: string;
}

export interface ChannelWindowsResult<R extends ViewStatRowLike, V extends VideoStatRowLike> {
  /** Rows after the `rowsSince` repoint clamp, in day order. */
  hist: R[];
  snaps: R[];
  dailies: R[];
  subs: R[];
  latestSnap: R | null;
  lifetimeViews: number | null;
  contentSinceMs: number | null;
  /** Uploads after the repoint clamp, newest first. */
  allVids: V[];
  windows: Record<string, WindowStat>;
}

/**
 * Per-channel 30/90/365-day view windows plus the intermediate slices the
 * /hq card also renders. Behaviour identical to the inline code it replaced.
 *
 * @param rows    ChannelViewStat rows for THIS channel, ascending by day
 * @param vidRows ChannelVideoStat rows for THIS channel, descending by publishedAt
 */
export function channelWindows<R extends ViewStatRowLike, V extends VideoStatRowLike>(
  rows: R[],
  vidRows: V[],
  cfg: WindowChannelConfig,
  now: number = Date.now(),
  windowDays: readonly number[] = VIEW_WINDOWS,
): ChannelWindowsResult<R, V> {
  // rowsSince: hard clamp for repointed cards — rows before it belong to a
  // different account entirely (see lib/view-counter.ts). Without this the
  // 30/90d windows baseline against the old account's lifetime snapshot
  // and report an enormous fake collapse (yt-ykh: 239 - 4,416,902).
  const rowsSinceMs = cfg.rowsSince ? Date.parse(cfg.rowsSince) : null;
  const hist = rows.filter((r) => !rowsSinceMs || r.day.getTime() >= rowsSinceMs);
  const snaps = hist.filter((r) => r.totalViews !== null);
  const dailies = hist.filter((r) => r.dayViews !== null);
  const subs = hist.filter((r) => r.subscribers !== null);

  const latestSnap = snaps[snaps.length - 1] ?? null;
  const lifetimeViews =
    latestSnap?.totalViews !== null && latestSnap?.totalViews !== undefined
      ? Number(latestSnap.totalViews)
      : dailies.length
        ? dailies.reduce((s, r) => s + (r.dayViews ?? 0), 0)
        : null;

  const contentSinceMs = cfg.contentSince ? Date.parse(cfg.contentSince) : null;

  // Repoint clamp, same as `hist` above: pre-repoint uploads under this key
  // belong to the account the card used to point at.
  const allVids = vidRows.filter((v) => !rowsSinceMs || v.publishedAt.getTime() >= rowsSinceMs);

  const windows: Record<string, WindowStat> = {};
  for (const days of windowDays) {
    const startMs = now - days * 86400_000;

    // Exact when a lifetime snapshot exists from before the window opened.
    const baseline = snaps.filter((r) => r.day.getTime() <= startMs).pop();
    // max(0): a lifetime counter can shrink (deleted videos, a slightly
    // short scrape passing the 98% guard) — tt-jared's did, and its
    // -52K window dragged the empire d30 TOTAL negative, which the
    // odometer clamps to a flat 0. Views received can never be < 0.
    if (baseline && latestSnap) {
      windows[`d${days}`] = {
        views: Math.max(0, Number(latestSnap.totalViews) - Number(baseline.totalViews)),
        partial: false,
        since: null,
      };
      continue;
    }
    // All content newer than the window start → lifetime IS the window.
    if (contentSinceMs && contentSinceMs >= startMs && lifetimeViews !== null) {
      windows[`d${days}`] = { views: lifetimeViews, partial: false, since: null };
      continue;
    }
    // 🔴 Facebook must NEVER fall through to its daily series. Meta's
    // `page_video_views` does not count Reels-feed distribution, and every
    // one of these Pages is reels-first, so that metric reads 4-6x low:
    // measured 2026-08-17, page_video_views vs summed per-reel views on the
    // same 30 days — Treasure Haul 1,314 vs 5,377, Your KC Homes 537 vs
    // 2,112, Wash & Dry 150 vs 937. The undercount was visible on the cards
    // themselves: W&D showed "150 views · 30 days" above a live strip
    // reporting 257 views on a single reel from the last 24 hours.
    //
    // The per-reel counts are the real number, so window = the views on
    // reels PUBLISHED inside the window. Same caveat as the live strip:
    // that is not "views received in the window" — a play today on a reel
    // from two months ago lands outside it. For these Pages the two are
    // close because reel traffic is almost entirely front-loaded, and it
    // beats a metric that structurally omits the main distribution surface.
    // Once 30d of lifetime snapshots exist (collectFbVideos started
    // 2026-08-17) the exact snapshot-delta branch above takes over on its
    // own and this stops being used for the 30d window.
    if (cfg.platform === "facebook" && allVids.length > 0) {
      const inWin = allVids.filter((v) => v.publishedAt.getTime() >= startMs);
      // The collector keeps FB_VIDEO_DAYS = 180 of reels, so a 365d window
      // genuinely cannot see the whole year — say so rather than implying
      // the coverage is complete.
      const oldest = allVids[allVids.length - 1].publishedAt;
      const covered = oldest.getTime() <= startMs + 2 * 86400_000;
      windows[`d${days}`] = {
        views: inWin.reduce((sum, v) => sum + Number(v.views), 0),
        partial: !covered,
        since: covered ? null : oldest.toISOString().slice(0, 10),
      };
      continue;
    }
    // Daily series (YT Analytics backfill; see above for why not FB).
    const inWindow = dailies.filter((r) => r.day.getTime() >= startMs);
    if (inWindow.length > 0) {
      const first = inWindow[0].day.getTime();
      const partial = dailies.length === inWindow.length && first > startMs + 2 * 86400_000;
      windows[`d${days}`] = {
        views: inWindow.reduce((s, r) => s + (r.dayViews ?? 0), 0),
        partial,
        since: partial ? inWindow[0].day.toISOString().slice(0, 10) : null,
      };
      continue;
    }
    // Only snapshots inside the window: views since tracking began.
    const firstSnap = snaps[0];
    if (firstSnap && latestSnap && firstSnap.id !== latestSnap.id) {
      windows[`d${days}`] = {
        views: Math.max(0, Number(latestSnap.totalViews) - Number(firstSnap.totalViews)),
        partial: true,
        since: firstSnap.day.toISOString().slice(0, 10),
      };
      continue;
    }
    windows[`d${days}`] = { views: null, partial: true, since: null };
  }

  return { hist, snaps, dailies, subs, latestSnap, lifetimeViews, contentSinceMs, allVids, windows };
}

/** Group rows by channelKey, preserving input order within each group. */
export function groupByChannel<T extends { channelKey: string }>(rows: T[]): Map<string, T[]> {
  const by = new Map<string, T[]>();
  for (const r of rows) {
    const list = by.get(r.channelKey) ?? [];
    list.push(r);
    by.set(r.channelKey, list);
  }
  return by;
}
