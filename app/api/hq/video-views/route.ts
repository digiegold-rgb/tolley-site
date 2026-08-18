import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { VIEW_CHANNELS } from "@/lib/view-counter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hq/video-views — every individual video the collector tracks, newest
// first, with its own view count. The view-counter cards answer "how is the
// channel doing"; this answers "which video worked", which is the only question
// that changes what gets made next.
//
// Facebook is the reason this exists: Meta's page_video_views metric doesn't
// count Reels-feed distribution, so a reels-first Page looks nearly dead in
// Page insights while its reels quietly rack up hundreds of views each. The
// per-video counts (collect.mjs → collectFbVideos) are the real number.

const CHANNEL_META = new Map(VIEW_CHANNELS.map((c) => [c.key, c]));

/** Rebuild a watch URL when the collector stored none (pre-8/17 YouTube rows). */
function fallbackUrl(channelKey: string, videoId: string): string | null {
  const platform = CHANNEL_META.get(channelKey)?.platform;
  if (platform === "youtube") return `https://www.youtube.com/watch?v=${videoId}`;
  return null;
}

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Cap high enough that the leaderboard is the WHOLE tracked set, not a
    // truncated view of it — a silent cut here would quietly under-report the
    // roll-up totals in the filter chips. The collector keeps 14d of YouTube
    // and 180d of Facebook uploads, which is ~500 rows today.
    const rows = await prisma.channelVideoStat.findMany({
      orderBy: { publishedAt: "desc" },
      take: 5000,
    });

    const videos = rows
      // A key can be retired from the roster while its rows linger; without a
      // channel to attribute them to they'd render as orphan cards.
      .filter((r) => CHANNEL_META.has(r.channelKey))
      // Same repoint clamp the view-counter cards apply to ChannelViewStat: a
      // card that was moved to a different account (yt-ykh left @digitalgold on
      // 2026-08-03) still has the OLD account's videos stored under its key,
      // frozen at the last pull before the switch. Showing them here attributes
      // 60 of @digitalgold's uploads to "Your KC Homes". The rows stay in the
      // table — auditable, just not attributed to the wrong channel.
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
          url: r.url ?? fallbackUrl(r.channelKey, r.videoId),
          pulledAt: r.pulledAt.toISOString(),
        };
      });

    // Per-channel roll-up for the filter chips. Only channels that actually
    // have per-video data appear — YouTube and Facebook today; TikTok/X are
    // scraped at the profile level and have no per-video rows to show.
    const byChannel = new Map<string, { key: string; label: string; platform: string; videos: number; views: number }>();
    for (const v of videos) {
      const e = byChannel.get(v.channelKey) ?? {
        key: v.channelKey, label: v.channelLabel, platform: v.platform, videos: 0, views: 0,
      };
      e.videos++;
      e.views += v.views;
      byChannel.set(v.channelKey, e);
    }

    return NextResponse.json({
      updatedAt: rows.length
        ? new Date(Math.max(...rows.map((r) => r.pulledAt.getTime()))).toISOString()
        : null,
      totalViews: videos.reduce((s, v) => s + v.views, 0),
      videos,
      channels: [...byChannel.values()].sort((a, b) => b.views - a.views),
    });
  } catch (err) {
    console.error("[hq/video-views GET]", err);
    return NextResponse.json({ error: "Failed to load video views" }, { status: 500 });
  }
}
