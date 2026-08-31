import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";
import { CHANNEL_KEYS } from "@/lib/view-counter";
import { loadViewCounter } from "@/lib/hq-posts-read";

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

// GET /api/hq/view-counter — same payload as lib/hq-posts-read loadViewCounter
// (shared with owner Animate Socials). Writers stay on POST above.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await loadViewCounter());
  } catch (err) {
    console.error("[hq/view-counter GET]", err);
    return NextResponse.json({ error: "Failed to load view counter" }, { status: 500 });
  }
}
