import { prisma } from "@/lib/prisma";
import { getCircleStats } from "@/lib/circle-stats";

/**
 * Rollups behind the /hq Stats tab: latest per-video YouTube snapshot with
 * 7d/28d view deltas, per-pipeline totals, and the cheap first-party numbers
 * (SiteView / circle leads / shop click-outs). Shared by GET /api/hq/stats
 * and the Analyze recap so both always describe the same data.
 */

export interface HqStatsVideoRow {
  videoId: string;
  title: string;
  pipeline: string;
  publishedAt: string;
  durationSec: number | null;
  day: string; // latest snapshot day
  views: number;
  likes: number;
  comments: number;
  avgViewDurationSec: number | null;
  avgViewPct: number | null;
  subsGained: number | null;
  views7d: number | null; // delta vs snapshot ≥7 days back (null = not enough history)
  views28d: number | null;
}

export interface HqStatsPipelineRollup {
  pipeline: string;
  videos: number;
  totalViews: number;
  views7d: number;
  avgViewPct: number | null;
}

export interface HqStatsPayload {
  videos: HqStatsVideoRow[];
  pipelines: HqStatsPipelineRollup[];
  firstParty: {
    siteViews30d: number;
    circleVisits30d: number;
    circleLeads30d: number;
    amazonClicks: number;
    goClicksYouTube: number;
  };
  lastPullAt: string | null;
  generatedAt: string;
}

function deltaAgainst(
  stats: { day: Date; views: number }[],
  latest: { day: Date; views: number },
  daysBack: number,
): number | null {
  const cutoff = new Date(latest.day.getTime() - daysBack * 24 * 60 * 60 * 1000);
  // stats are day-ascending; find the newest snapshot at or before the cutoff.
  let base: { day: Date; views: number } | null = null;
  for (const s of stats) {
    if (s.day <= cutoff) base = s;
    else break;
  }
  return base ? latest.views - base.views : null;
}

export async function buildHqStatsPayload(): Promise<HqStatsPayload> {
  const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [videos, circle, siteViews30d, shopAgg] = await Promise.all([
    prisma.youTubeVideo.findMany({
      include: {
        stats: {
          where: { day: { gte: since } },
          orderBy: { day: "asc" },
        },
      },
      orderBy: { publishedAt: "desc" },
    }),
    getCircleStats().catch(() => null),
    prisma.siteView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.product.aggregate({
      _sum: { amazonClicks: true, goClicksYouTube: true },
    }),
  ]);

  const rows: HqStatsVideoRow[] = [];
  let lastPullAt: Date | null = null;

  for (const v of videos) {
    const latest = v.stats[v.stats.length - 1];
    if (!latest) continue; // pushed by the DGX map but never pulled yet
    if (!lastPullAt || latest.pulledAt > lastPullAt) lastPullAt = latest.pulledAt;
    rows.push({
      videoId: v.videoId,
      title: v.title,
      pipeline: v.pipeline,
      publishedAt: v.publishedAt.toISOString(),
      durationSec: v.durationSec,
      day: latest.day.toISOString().slice(0, 10),
      views: latest.views,
      likes: latest.likes,
      comments: latest.comments,
      avgViewDurationSec: latest.avgViewDurationSec,
      avgViewPct: latest.avgViewPct,
      subsGained: latest.subsGained,
      views7d: deltaAgainst(v.stats, latest, 7),
      views28d: deltaAgainst(v.stats, latest, 28),
    });
  }

  const byPipeline = new Map<string, HqStatsVideoRow[]>();
  for (const r of rows) {
    const list = byPipeline.get(r.pipeline) ?? [];
    list.push(r);
    byPipeline.set(r.pipeline, list);
  }
  const pipelines: HqStatsPipelineRollup[] = [...byPipeline.entries()]
    .map(([pipeline, list]) => {
      const withPct = list.filter((r) => r.avgViewPct != null);
      return {
        pipeline,
        videos: list.length,
        totalViews: list.reduce((sum, r) => sum + r.views, 0),
        views7d: list.reduce((sum, r) => sum + (r.views7d ?? 0), 0),
        avgViewPct: withPct.length
          ? withPct.reduce((sum, r) => sum + (r.avgViewPct ?? 0), 0) / withPct.length
          : null,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews);

  return {
    videos: rows,
    pipelines,
    firstParty: {
      siteViews30d,
      circleVisits30d: circle?.totals.visits30d ?? 0,
      circleLeads30d: circle?.totals.leads30d ?? 0,
      amazonClicks: shopAgg._sum.amazonClicks ?? 0,
      goClicksYouTube: shopAgg._sum.goClicksYouTube ?? 0,
    },
    lastPullAt: lastPullAt ? lastPullAt.toISOString() : null,
    generatedAt: new Date().toISOString(),
  };
}
