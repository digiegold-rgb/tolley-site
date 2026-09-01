/**
 * Shared READ helpers for HQ Posts metrics.
 *
 * Used by /api/hq/* (PIN cookie) and GET /api/vater/socials/house (owner
 * Animate dashboard). Same ChannelViewStat / ChannelVideoStat / HqAdsSnapshot /
 * PostLogEntry / DgxActivity rows the HQ Posts tab already shows.
 *
 * READ ONLY. Ads collect + snapshot writes stay on /api/hq/ads-status.
 * View-counter / video-views writers stay on the HQ POST routes and the
 * existing DGX cron. Do not add a second collect path here.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { isMissingSchemaError } from "@/lib/vater/schema-probe";
import {
  isAdsSnapshot,
  snapshotFromJson,
  type AdsSnapshot,
} from "@/lib/hq-ads";
import { VIEW_CHANNELS } from "@/lib/view-counter";
import { channelWindows, VIEW_WINDOWS } from "@/lib/view-counter-windows";
import { computeHealth, SCHEDULED_JOBS } from "@/lib/post-schedule";

export type DgxActivityPayload = {
  line: string | null;
  updatedAt: string | null;
};

export type ViewCounterPayload = {
  updatedAt: string | null;
  totals: Record<string, { views: number; partial: boolean }>;
  channels: ReturnType<typeof shapeViewChannel>[];
};

export type VideoViewsPayload = {
  updatedAt: string | null;
  totalViews: number;
  videos: Array<{
    id: string;
    channelKey: string;
    channelLabel: string;
    platform: string;
    videoId: string;
    title: string;
    publishedAt: string;
    views: number;
    url: string | null;
    pulledAt: string;
  }>;
  channels: Array<{
    key: string;
    label: string;
    platform: string;
    videos: number;
    views: number;
  }>;
};

export type PostLogPayload = {
  days: number;
  runs: Array<{
    runId: string;
    job: string;
    title: string | null;
    firedAt: string;
    costCents: number;
    renderCents: number;
    renderEstimated: boolean;
    channels: unknown[];
  }>;
  health: ReturnType<typeof computeHealth>;
  summary: {
    posts: number;
    ok: number;
    failed: number;
    skipped: number;
    costCents: number;
    costByChannel: Record<string, number>;
    problems: number;
    declaredChannels: number;
  };
};

const CHANNEL_META = new Map(VIEW_CHANNELS.map((c) => [c.key, c]));

/** YouTube subscriberCount rounding — same rule as /api/hq/view-counter. */
export function subRoundingFor(platform: string, subs: number | null): number {
  if (platform !== "youtube" || subs === null || subs < 1000) return 1;
  return 10 ** (Math.floor(Math.log10(subs)) - 2);
}

function fallbackVideoUrl(channelKey: string, videoId: string): string | null {
  const platform = CHANNEL_META.get(channelKey)?.platform;
  if (platform === "youtube") return `https://www.youtube.com/watch?v=${videoId}`;
  return null;
}

export async function readDgxActivity(): Promise<DgxActivityPayload> {
  try {
    const row = await prisma.dgxActivity.findUnique({ where: { id: 1 } });
    if (!row) return { line: null, updatedAt: null };
    return { line: row.line, updatedAt: row.updatedAt.toISOString() };
  } catch (err) {
    if (isMissingSchemaError(err)) return { line: null, updatedAt: null };
    throw err;
  }
}

/** Cached HqAdsSnapshot only — never collect, never write. */
export async function readCachedAdsSnapshot(): Promise<{
  snapshot: AdsSnapshot | null;
  updatedAt: Date | null;
}> {
  try {
    const row = await prisma.hqAdsSnapshot.findUnique({ where: { id: 1 } });
    if (!row) return { snapshot: null, updatedAt: null };
    const snapshot = snapshotFromJson(row.payload);
    return {
      snapshot: snapshot && isAdsSnapshot(snapshot) ? snapshot : null,
      updatedAt: row.updatedAt,
    };
  } catch (err) {
    if (isMissingSchemaError(err)) return { snapshot: null, updatedAt: null };
    throw err;
  }
}

function shapeViewChannel(
  cfg: (typeof VIEW_CHANNELS)[number],
  histRows: Awaited<ReturnType<typeof prisma.channelViewStat.findMany>>,
  vidRows: Awaited<ReturnType<typeof prisma.channelVideoStat.findMany>>,
  now: number,
) {
  const w = channelWindows(histRows, vidRows, cfg, now);
  const { hist, dailies, subs, latestSnap, lifetimeViews, contentSinceMs, allVids, windows } = w;
  const vids = allVids.filter((v) => v.publishedAt.getTime() >= now - 8 * 86400_000);

  const latestSubs = subs[subs.length - 1]?.subscribers ?? null;
  const subsSinceMs = cfg.subsSince ? Date.parse(cfg.subsSince) : contentSinceMs;
  const subsForDelta = subsSinceMs ? subs.filter((r) => r.day.getTime() >= subsSinceMs) : subs;
  const subAt = (daysAgo: number): number | null => {
    const cutoff = now - daysAgo * 86400_000;
    const past = subsForDelta.filter((r) => r.day.getTime() <= cutoff);
    return past[past.length - 1]?.subscribers ?? null;
  };
  const sub1d = subAt(1);
  const sub7d = subAt(7);

  const lastDaily = dailies[dailies.length - 1]?.day ?? null;
  const lastSnapDay = latestSnap?.day ?? null;
  const viewsThrough =
    lastDaily && lastSnapDay
      ? new Date(Math.max(lastDaily.getTime(), lastSnapDay.getTime()))
      : (lastDaily ?? lastSnapDay);

  const liveFor = (hours: number) => {
    const since = now - hours * 3600_000;
    const inRange = vids.filter((v) => v.publishedAt.getTime() >= since);
    return {
      views: inRange.reduce((s, v) => s + Number(v.views), 0),
      videos: inRange.length,
    };
  };
  const top = vids.reduce<(typeof vids)[number] | null>(
    (best, v) => (best === null || Number(v.views) > Number(best.views) ? v : best),
    null,
  );

  return {
    key: cfg.key,
    platform: cfg.platform,
    label: cfg.label,
    note: cfg.note ?? null,
    url: cfg.url,
    lifetimeViews,
    subscribers: latestSubs,
    subDelta1d: latestSubs !== null && sub1d !== null ? latestSubs - sub1d : null,
    subDelta7d: latestSubs !== null && sub7d !== null ? latestSubs - sub7d : null,
    subRounding: subRoundingFor(cfg.platform, latestSubs),
    windows,
    viewsThrough: viewsThrough ? viewsThrough.toISOString().slice(0, 10) : null,
    live: vids.length
      ? {
          h24: liveFor(24),
          d7: liveFor(24 * 7),
          topTitle: top?.title ?? null,
          topViews: top ? Number(top.views) : null,
          topVideoId: top?.videoId ?? null,
          asOf: new Date(vids.reduce((m, v) => Math.max(m, v.pulledAt.getTime()), 0)).toISOString(),
        }
      : null,
    lastPulledAt: hist.length ? hist[hist.length - 1].pulledAt.toISOString() : null,
  };
}

export async function loadViewCounter(): Promise<ViewCounterPayload> {
  const rows = await prisma.channelViewStat.findMany({
    orderBy: { day: "asc" },
  });
  const byChannel = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byChannel.get(r.channelKey) ?? [];
    list.push(r);
    byChannel.set(r.channelKey, list);
  }

  const vidRows = await prisma.channelVideoStat.findMany({
    where: { publishedAt: { gte: new Date(Date.now() - 370 * 86400_000) } },
    orderBy: { publishedAt: "desc" },
  });
  const vidsByChannel = new Map<string, typeof vidRows>();
  for (const v of vidRows) {
    const list = vidsByChannel.get(v.channelKey) ?? [];
    list.push(v);
    vidsByChannel.set(v.channelKey, list);
  }

  const now = Date.now();
  const channels = VIEW_CHANNELS.map((cfg) =>
    shapeViewChannel(cfg, byChannel.get(cfg.key) ?? [], vidsByChannel.get(cfg.key) ?? [], now),
  );

  const viewChannels = channels.filter(
    (c) => c.platform !== "bluesky" && c.platform !== "linkedin" && c.platform !== "pinterest",
  );
  const totals: Record<string, { views: number; partial: boolean }> = {};
  for (const days of VIEW_WINDOWS) {
    const k = `d${days}`;
    totals[k] = {
      views: viewChannels.reduce((s, c) => s + (c.windows[k]?.views ?? 0), 0),
      partial: viewChannels.some((c) => c.windows[k]?.partial && (c.windows[k]?.views ?? 0) > 0),
    };
  }
  totals.lifetime = {
    views: viewChannels.reduce((s, c) => s + (c.lifetimeViews ?? 0), 0),
    partial: viewChannels.some((c) => c.platform === "facebook" && (c.lifetimeViews ?? 0) > 0),
  };

  return {
    updatedAt: rows.length
      ? new Date(Math.max(...rows.map((r) => r.pulledAt.getTime()))).toISOString()
      : null,
    totals,
    channels,
  };
}

export async function loadVideoViews(): Promise<VideoViewsPayload> {
  const rows = await prisma.channelVideoStat.findMany({
    orderBy: { publishedAt: "desc" },
    take: 5000,
  });

  const videos = rows
    .filter((r) => CHANNEL_META.has(r.channelKey))
    .filter((r) => {
      const since = CHANNEL_META.get(r.channelKey)!.rowsSince;
      return !since || r.publishedAt.getTime() >= Date.parse(since);
    })
    .map((r) => {
      const cfg = CHANNEL_META.get(r.channelKey)!;
      return {
        id: r.id,
        channelKey: r.channelKey,
        channelLabel: cfg.label,
        platform: cfg.platform,
        videoId: r.videoId,
        title: r.title,
        publishedAt: r.publishedAt.toISOString(),
        views: Number(r.views),
        url: r.url ?? fallbackVideoUrl(r.channelKey, r.videoId),
        pulledAt: r.pulledAt.toISOString(),
      };
    });

  const byChannel = new Map<
    string,
    { key: string; label: string; platform: string; videos: number; views: number }
  >();
  for (const v of videos) {
    const e = byChannel.get(v.channelKey) ?? {
      key: v.channelKey,
      label: v.channelLabel,
      platform: v.platform,
      videos: 0,
      views: 0,
    };
    e.videos++;
    e.views += v.views;
    byChannel.set(v.channelKey, e);
  }

  return {
    updatedAt: rows.length
      ? new Date(Math.max(...rows.map((r) => r.pulledAt.getTime()))).toISOString()
      : null,
    totalViews: videos.reduce((s, v) => s + v.views, 0),
    videos,
    channels: [...byChannel.values()].sort((a, b) => b.views - a.views),
  };
}

export async function loadPostLog(daysRaw: number): Promise<PostLogPayload> {
  const days = Math.min(90, Math.max(1, Number(daysRaw) || 7));
  const since = new Date(Date.now() - days * 24 * 3_600_000);

  const entries = await prisma.postLogEntry.findMany({
    where: { firedAt: { gte: since } },
    orderBy: { firedAt: "desc" },
    take: 1000,
  });

  const healthRows = await prisma.postLogEntry.findMany({
    where: { firedAt: { gte: new Date(Date.now() - 90 * 24 * 3_600_000) } },
    orderBy: { firedAt: "desc" },
    select: { job: true, channel: true, status: true, firedAt: true, url: true, error: true },
  });
  const health = computeHealth(healthRows);

  const runs = new Map<
    string,
    {
      runId: string;
      job: string;
      title: string | null;
      firedAt: string;
      costCents: number;
      channels: typeof entries;
    }
  >();
  for (const e of entries) {
    const r = runs.get(e.runId);
    if (r) {
      r.channels.push(e);
      r.costCents += e.costCents;
      if (e.firedAt.toISOString() > r.firedAt) r.firedAt = e.firedAt.toISOString();
    } else {
      runs.set(e.runId, {
        runId: e.runId,
        job: e.job,
        title: e.title,
        firedAt: e.firedAt.toISOString(),
        costCents: e.costCents,
        channels: [e],
      });
    }
  }

  const costByChannel: Record<string, number> = {};
  for (const e of entries) {
    if (e.costCents > 0) costByChannel[e.channel] = (costByChannel[e.channel] ?? 0) + e.costCents;
  }

  const videoKeys = [...new Set(entries.map((e) => e.videoKey).filter((k): k is string => !!k))];
  const renderByKey = new Map<string, { cents: number; estimated: boolean }>();
  if (videoKeys.length) {
    const costs = await prisma.videoCost.findMany({ where: { videoKey: { in: videoKeys } } });
    for (const c of costs) {
      renderByKey.set(c.videoKey, {
        cents: c.clipsCents + c.lipsyncCents + c.imageCents + c.scriptCents + c.ttsCents + c.postCents,
        estimated: c.estimated,
      });
    }
  }
  const runsOut = Array.from(runs.values()).map((r) => {
    const keys = [...new Set(r.channels.map((e) => e.videoKey).filter((k): k is string => !!k))];
    let renderCents = 0;
    let renderEstimated = false;
    for (const k of keys) {
      const rc = renderByKey.get(k);
      if (rc) {
        renderCents += rc.cents;
        renderEstimated = renderEstimated || rc.estimated;
      }
    }
    return { ...r, renderCents, renderEstimated };
  });

  return {
    days,
    runs: runsOut.sort((a, b) => b.firedAt.localeCompare(a.firedAt)),
    health,
    summary: {
      posts: entries.length,
      ok: entries.filter((e) => e.status === "ok").length,
      failed: entries.filter((e) => e.status === "fail").length,
      skipped: entries.filter((e) => e.status === "skipped").length,
      costCents: entries.reduce((s, e) => s + e.costCents, 0),
      costByChannel,
      problems: health.filter((h) => h.status !== "ok").length,
      declaredChannels: SCHEDULED_JOBS.reduce((s, j) => s + j.channels.length, 0),
    },
  };
}

export type HousePostsPayload = {
  dgx: DgxActivityPayload | null;
  ads: AdsSnapshot | null;
  views: ViewCounterPayload | null;
  videos: VideoViewsPayload | null;
  posts: PostLogPayload | null;
  errors: Partial<Record<"dgx" | "ads" | "views" | "videos" | "posts", string>>;
};

async function settled<T>(label: keyof HousePostsPayload["errors"], work: () => Promise<T>): Promise<{
  value: T | null;
  error?: string;
}> {
  try {
    return { value: await work() };
  } catch (err) {
    const message = err instanceof Error ? err.message : `${label} failed`;
    console.error(`[hq-posts-read ${label}]`, err);
    return { value: null, error: message };
  }
}

/** One house-dashboard read for the owner Animate Socials API. */
export async function loadHousePosts(days = 7): Promise<HousePostsPayload> {
  const [dgx, ads, views, videos, posts] = await Promise.all([
    settled("dgx", readDgxActivity),
    settled("ads", async () => (await readCachedAdsSnapshot()).snapshot),
    settled("views", loadViewCounter),
    settled("videos", loadVideoViews),
    settled("posts", () => loadPostLog(days)),
  ]);

  const errors: HousePostsPayload["errors"] = {};
  if (dgx.error) errors.dgx = dgx.error;
  if (ads.error) errors.ads = ads.error;
  if (views.error) errors.views = views.error;
  if (videos.error) errors.videos = videos.error;
  if (posts.error) errors.posts = posts.error;

  return {
    dgx: dgx.value,
    ads: ads.value,
    views: views.value,
    videos: videos.value,
    posts: posts.value,
    errors,
  };
}
