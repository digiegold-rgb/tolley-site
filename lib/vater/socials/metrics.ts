/**
 * lib/vater/socials/metrics.ts
 *
 * Pure parsers for Zernio analytics payloads. Every metric field is optional —
 * vendors omit keys freely, and a missing / 404 / 501 insight is `null`, not
 * a throw. Used by the vendor client AND the collector tests so we never
 * need a live Zernio key to verify the mapping.
 */

export interface SocialMetrics {
  followers: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  reach: number | null;
  watchTimeSec: number | null;
}

export const EMPTY_METRICS: SocialMetrics = {
  followers: null,
  views: null,
  likes: null,
  comments: null,
  shares: null,
  impressions: null,
  reach: null,
  watchTimeSec: null,
};

const FOLLOWER_KEYS = [
  "followers",
  "followerCount",
  "followersCount",
  "subscriberCount",
  "subscribers",
  "pageFollowers",
] as const;

const VIEW_KEYS = [
  "views",
  "viewCount",
  "videoViews",
  "mediaViews",
  "plays",
] as const;

const LIKE_KEYS = ["likes", "likeCount", "reactions"] as const;
const COMMENT_KEYS = ["comments", "commentCount"] as const;
const SHARE_KEYS = ["shares", "shareCount", "reposts"] as const;
const IMPRESSION_KEYS = ["impressions", "impressionCount"] as const;
const REACH_KEYS = ["reach", "reachCount"] as const;
const WATCH_KEYS = [
  "watchTimeSec",
  "watchTimeSeconds",
  "estimatedMinutesWatched",
  "watchTimeMinutes",
] as const;

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    if (!(k in obj)) continue;
    const n = asFiniteNumber(obj[k]);
    if (n !== null) return n;
  }
  return null;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Flatten a vendor insight: metrics may live at the top level or under
 *  `metrics` / `totals` / `summary`. Last non-null per field wins. */
export function parseMetrics(raw: unknown): SocialMetrics {
  const out: SocialMetrics = { ...EMPTY_METRICS };
  const root = asRecord(raw);
  if (!root) return out;
  const bags: Record<string, unknown>[] = [root];
  for (const nest of ["metrics", "totals", "summary", "data"] as const) {
    const inner = asRecord(root[nest]);
    if (inner) bags.push(inner);
  }
  for (const bag of bags) {
    const next: SocialMetrics = {
      followers: pickNumber(bag, FOLLOWER_KEYS),
      views: pickNumber(bag, VIEW_KEYS),
      likes: pickNumber(bag, LIKE_KEYS),
      comments: pickNumber(bag, COMMENT_KEYS),
      shares: pickNumber(bag, SHARE_KEYS),
      impressions: pickNumber(bag, IMPRESSION_KEYS),
      reach: pickNumber(bag, REACH_KEYS),
      watchTimeSec: (() => {
        const rawWatch = pickNumber(bag, WATCH_KEYS);
        if (rawWatch === null) return null;
        if ("estimatedMinutesWatched" in bag || "watchTimeMinutes" in bag) {
          return Math.round(rawWatch * 60);
        }
        return rawWatch;
      })(),
    };
    for (const key of Object.keys(out) as (keyof SocialMetrics)[]) {
      if (next[key] !== null) out[key] = next[key];
    }
  }
  return out;
}

/** Merge several optional insight payloads (youtube channel + daily-views,
 *  instagram history + account-insights). Later non-null fields overwrite. */
export function mergeMetrics(...parts: Array<SocialMetrics | null | undefined>): SocialMetrics {
  const out: SocialMetrics = { ...EMPTY_METRICS };
  for (const p of parts) {
    if (!p) continue;
    for (const key of Object.keys(out) as (keyof SocialMetrics)[]) {
      if (p[key] !== null) out[key] = p[key];
    }
  }
  return out;
}

export function metricsToBigInt(m: SocialMetrics): {
  followers: bigint | null;
  views: bigint | null;
  likes: bigint | null;
  comments: bigint | null;
  shares: bigint | null;
  impressions: bigint | null;
  reach: bigint | null;
  watchTimeSec: bigint | null;
} {
  const to = (n: number | null): bigint | null =>
    n === null || !Number.isFinite(n) ? null : BigInt(Math.round(n));
  return {
    followers: to(m.followers),
    views: to(m.views),
    likes: to(m.likes),
    comments: to(m.comments),
    shares: to(m.shares),
    impressions: to(m.impressions),
    reach: to(m.reach),
    watchTimeSec: to(m.watchTimeSec),
  };
}

/** Vendor post id on a GET /v1/analytics row. Accepts several aliases. */
export function vendorPostIdOf(raw: unknown): string | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  for (const k of ["postId", "_id", "id", "latePostId", "externalPostId"] as const) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const post = asRecord(rec.post);
  if (post) {
    for (const k of ["_id", "id", "postId"] as const) {
      const v = post[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

export function utcMidnight(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
