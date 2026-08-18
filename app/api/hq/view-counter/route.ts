import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";
import { VIEW_CHANNELS, CHANNEL_KEYS } from "@/lib/view-counter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Facebook pushes a few hundred per-video rows per run on top of the daily
// series. Set here rather than in vercel.json — that file's `functions` map is
// capped at 50 entries and is already full.
export const maxDuration = 120;

// POST /api/hq/view-counter — the DGX pushes snapshot + daily rows hourly
// (collect.mjs, x-sync-secret auth). Upsert on channelKey+day; a null field in
// the payload never clobbers a value an earlier push already recorded, so the
// hourly snapshot push and the daily-series backfill can share days safely.
export async function POST(request: NextRequest) {
  const header = request.headers.get("x-sync-secret");
  if (!header || !secretEquals(header, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an array" }, { status: 400 });
  }

  let upserted = 0;
  let videos = 0;
  let skipped = 0;
  // Per-video rows are independent of each other, so they go up in parallel
  // chunks — Facebook pushes a few hundred of them per run and one-at-a-time
  // round trips blew past the function timeout.
  const videoWrites: Promise<unknown>[] = [];
  const flushVideos = async () => {
    while (videoWrites.length) await Promise.all(videoWrites.splice(0, 20));
  };
  for (const raw of body) {
    if (!raw || typeof raw !== "object") { skipped++; continue; }
    const item = raw as Record<string, unknown>;
    const channelKey = typeof item.channelKey === "string" ? item.channelKey : "";

    // Per-video rows are distinguished by carrying a videoId; everything else
    // is a day row. One endpoint, one push, two tables.
    if (typeof item.videoId === "string" && item.videoId) {
      const publishedMs = Date.parse(String(item.publishedAt ?? ""));
      if (!CHANNEL_KEYS.has(channelKey) || Number.isNaN(publishedMs)) { skipped++; continue; }
      const videoId = item.videoId;
      const url = typeof item.url === "string" && item.url ? item.url.slice(0, 500) : null;
      const data = {
        title: String(item.title ?? "").slice(0, 300),
        publishedAt: new Date(publishedMs),
        views: BigInt(Math.max(0, Math.round(Number(item.views ?? 0)))),
        // A push that omits the url must not erase one an earlier push stored.
        ...(url ? { url } : {}),
        pulledAt: new Date(),
      };
      videoWrites.push(
        prisma.channelVideoStat.upsert({
          where: { channelKey_videoId: { channelKey, videoId } },
          create: { channelKey, videoId, ...data },
          update: data,
        }),
      );
      if (videoWrites.length >= 20) await Promise.all(videoWrites.splice(0, 20));
      videos++;
      continue;
    }

    const dayRaw = typeof item.day === "string" ? item.day : "";
    const dayMs = Date.parse(dayRaw);
    if (!CHANNEL_KEYS.has(channelKey) || Number.isNaN(dayMs)) { skipped++; continue; }
    const d = new Date(dayMs);
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    const totalViews =
      item.totalViews === null || item.totalViews === undefined ? null : BigInt(Math.round(Number(item.totalViews)));
    const dayViews =
      item.dayViews === null || item.dayViews === undefined ? null : Math.max(0, Math.round(Number(item.dayViews)));
    const subscribers =
      item.subscribers === null || item.subscribers === undefined ? null : Math.max(0, Math.round(Number(item.subscribers)));

    await prisma.channelViewStat.upsert({
      where: { channelKey_day: { channelKey, day } },
      create: { channelKey, day, totalViews, dayViews, subscribers },
      update: {
        ...(totalViews !== null ? { totalViews } : {}),
        ...(dayViews !== null ? { dayViews } : {}),
        ...(subscribers !== null ? { subscribers } : {}),
        pulledAt: new Date(),
      },
    });
    upserted++;
  }
  await flushVideos();

  return NextResponse.json({ ok: true, upserted, videos, skipped });
}

interface WindowStat {
  views: number | null;
  partial: boolean; // true when history doesn't reach the window start
  since: string | null; // where coverage actually begins, when partial
}

const WINDOWS = [30, 90, 365] as const;

// YouTube's public API rounds subscriberCount to 3 significant figures above
// 1,000 — an 18,800→18,700 "drop" can be a single real unsubscribe crossing a
// rounding boundary, or nothing at all. Return the granularity so the UI can
// stop rendering one-granule swings as if they were measured churn.
function subRoundingFor(platform: string, subs: number | null): number {
  if (platform !== "youtube" || subs === null || subs < 1000) return 1;
  return 10 ** (Math.floor(Math.log10(subs)) - 2);
}

// GET /api/hq/view-counter — everything the counter UI renders. Per channel:
// lifetime views, subscribers with 1d/7d deltas, and 30/90/365d view windows.
// Window math prefers the exact method available per platform: cumulative
// deltas for YouTube (lifetime counter snapshots), summed daily series for
// Facebook (no lifetime counter exists). See lib/view-counter.ts for the
// contentSince rule that makes brand-new channels show full numbers on day one.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.channelViewStat.findMany({
      orderBy: { day: "asc" },
    });
    const byChannel = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byChannel.get(r.channelKey) ?? [];
      list.push(r);
      byChannel.set(r.channelKey, list);
    }

    // Near-realtime side: views on recent uploads, straight from the Data API.
    // This is deliberately "views ON uploads from the last N days", NOT "views
    // received in the last N days" — a play on a 2-year-old video is not
    // counted. It tracks the lagged windows closely only because this channel's
    // traffic is overwhelmingly on fresh content.
    // Pulled over the full window horizon, not just the live strip's 8 days:
    // Facebook's view WINDOWS are built from these rows too (see fbWindow).
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
    const channels = VIEW_CHANNELS.map((cfg) => {
      // rowsSince: hard clamp for repointed cards — rows before it belong to a
      // different account entirely (see lib/view-counter.ts). Without this the
      // 30/90d windows baseline against the old account's lifetime snapshot
      // and report an enormous fake collapse (yt-ykh: 239 - 4,416,902).
      const rowsSinceMs = cfg.rowsSince ? Date.parse(cfg.rowsSince) : null;
      const hist = (byChannel.get(cfg.key) ?? []).filter(
        (r) => !rowsSinceMs || r.day.getTime() >= rowsSinceMs,
      );
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
      const allVids = (vidsByChannel.get(cfg.key) ?? []).filter(
        (v) => !rowsSinceMs || v.publishedAt.getTime() >= rowsSinceMs,
      );
      // The live strip is deliberately narrow — "did this morning's post land".
      const vids = allVids.filter(
        (v) => v.publishedAt.getTime() >= now - 8 * 86400_000,
      );

      const latestSubs = subs[subs.length - 1]?.subscribers ?? null;
      // Subscriber deltas must never reach back past contentSince. When a card
      // is repointed at a different channel (yt-ykh moved off @digitalgold on
      // 2026-08-03), the older rows belong to the PREVIOUS channel, and
      // comparing against them reports a catastrophic fake loss — the card
      // showed "-18,700 subs in 1d" purely because the account changed.
      // A repoint can happen mid-day, so contentSince (a content-history date)
      // is too coarse to fix this — subsSince is the explicit baseline.
      const subsSinceMs = cfg.subsSince
        ? Date.parse(cfg.subsSince)
        : contentSinceMs;
      const subsForDelta = subsSinceMs
        ? subs.filter((r) => r.day.getTime() >= subsSinceMs)
        : subs;
      const subAt = (daysAgo: number): number | null => {
        const cutoff = now - daysAgo * 86400_000;
        // last reading at or before the cutoff — the honest "what was it then"
        const past = subsForDelta.filter((r) => r.day.getTime() <= cutoff);
        return past[past.length - 1]?.subscribers ?? null;
      };
      const sub1d = subAt(1);
      const sub7d = subAt(7);

      const windows: Record<string, WindowStat> = {};
      for (const days of WINDOWS) {
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

      // How current the *view* numbers are, which is not how recently we polled:
      // YouTube Analytics publishes a day roughly 3 days late, so a 30d window
      // built from its daily series really ends 3 days ago. Surface that rather
      // than letting an hourly "updated 5m ago" imply the views are live.
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
              asOf: new Date(
                vids.reduce((m, v) => Math.max(m, v.pulledAt.getTime()), 0),
              ).toISOString(),
            }
          : null,
        lastPulledAt: hist.length ? hist[hist.length - 1].pulledAt.toISOString() : null,
      };
    });

    // Keep non-view metrics out of the empire-wide "total views" so the
    // headline stays a true view count: Bluesky's number is LIKES, and
    // LinkedIn's is IMPRESSIONS (a feed-appearance count, not a watch).
    const viewChannels = channels.filter(
      (c) => c.platform !== "bluesky" && c.platform !== "linkedin" && c.platform !== "pinterest");
    const totals: Record<string, { views: number; partial: boolean }> = {};
    for (const days of WINDOWS) {
      const k = `d${days}`;
      totals[k] = {
        views: viewChannels.reduce((s, c) => s + (c.windows[k]?.views ?? 0), 0),
        partial: viewChannels.some((c) => c.windows[k]?.partial && (c.windows[k]?.views ?? 0) > 0),
      };
    }
    totals.lifetime = {
      views: viewChannels.reduce((s, c) => s + (c.lifetimeViews ?? 0), 0),
      // FB "lifetime" is only as old as its daily history — always flag it.
      partial: viewChannels.some((c) => c.platform === "facebook" && (c.lifetimeViews ?? 0) > 0),
    };

    return NextResponse.json({
      updatedAt: rows.length
        ? new Date(Math.max(...rows.map((r) => r.pulledAt.getTime()))).toISOString()
        : null,
      totals,
      channels,
    });
  } catch (err) {
    console.error("[hq/view-counter GET]", err);
    return NextResponse.json({ error: "Failed to load view counter" }, { status: 500 });
  }
}
