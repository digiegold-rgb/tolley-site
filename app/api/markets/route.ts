import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const WORKER_URL = process.env.MARKET_WORKER_URL || "http://localhost:8901";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

/**
 * GET /api/markets — List data points (public for basic, auth for full)
 * Query: type, scope, days, limit, fields
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const scope = searchParams.get("scope");
  const days = parseInt(searchParams.get("days") || "30");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const fields = searchParams.get("fields");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (scope) where.scope = scope;
  if (days > 0) {
    where.createdAt = { gte: new Date(Date.now() - days * 86400000) };
  }

  const select = fields === "url"
    ? { url: true }
    : {
        id: true,
        type: true,
        title: true,
        url: true,
        scope: true,
        sentiment: true,
        signal: true,
        signalConfidence: true,
        summary: true,
        analysis: true,
        numericValue: true,
        previousValue: true,
        changePercent: true,
        publishedAt: true,
        tags: true,
        createdAt: true,
      };

  const dataPoints = await prisma.marketDataPoint.findMany({
    where,
    select,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ dataPoints, count: dataPoints.length });
}

/**
 * Resolve a YouTube channel URL to a channel ID.
 * Supports: youtube.com/@handle, youtube.com/channel/ID, youtube.com/c/name
 */
async function resolveYouTubeChannelId(channelUrl: string): Promise<{ channelId: string; channelName: string }> {
  // Already a channel ID
  if (/^UC[\w-]{22}$/.test(channelUrl)) {
    return { channelId: channelUrl, channelName: channelUrl };
  }

  // Fetch the channel page and extract the canonical channel ID
  const res = await fetch(channelUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch YouTube channel page: ${res.status}`);
  }

  const html = await res.text();

  // Extract channel ID from various patterns in the HTML
  const channelIdMatch =
    html.match(/"channelId":"(UC[\w-]{22})"/) ||
    html.match(/channel_id=(UC[\w-]{22})/) ||
    html.match(/<meta itemprop="channelId" content="(UC[\w-]{22})"/) ||
    html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);

  if (!channelIdMatch?.[1]) {
    throw new Error("Could not extract channel ID from the YouTube page");
  }

  // Extract channel name
  const nameMatch =
    html.match(/"ownerChannelName":"([^"]+)"/) ||
    html.match(/<meta property="og:title" content="([^"]+)"/) ||
    html.match(/<title>([^<]+)<\/title>/);

  const channelName = nameMatch?.[1]?.replace(/ - YouTube$/, "").trim() || channelIdMatch[1];

  return { channelId: channelIdMatch[1], channelName };
}

/**
 * POST /api/markets — Manual input dispatch
 * Body: { type: "youtube"|"article"|"note"|"rss"|"channel", url?, text?, title? }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, url, text, title } = body;

  // ─── YouTube video: dispatch to worker ───
  if (type === "youtube" && url) {
    try {
      const res = await fetch(`${WORKER_URL}/collect/youtube`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": SYNC_SECRET,
        },
        body: JSON.stringify({ url }),
      });
      const result = await res.json();
      return NextResponse.json({
        ok: true,
        dispatched: "youtube",
        dataPoints: result.dataPoints?.length || 0,
        errors: result.errors || [],
      });
    } catch (e) {
      return NextResponse.json(
        { error: `Worker unreachable: ${e instanceof Error ? e.message : e}` },
        { status: 502 },
      );
    }
  }

  // ─── Article URL: dispatch to worker ───
  if (type === "article" && url) {
    try {
      const res = await fetch(`${WORKER_URL}/collect/article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": SYNC_SECRET,
        },
        body: JSON.stringify({ url }),
      });
      const result = await res.json();
      return NextResponse.json({
        ok: true,
        dispatched: "article",
        dataPoints: result.dataPoints?.length || 0,
        errors: result.errors || [],
      });
    } catch (e) {
      return NextResponse.json(
        { error: `Worker unreachable: ${e instanceof Error ? e.message : e}` },
        { status: 502 },
      );
    }
  }

  // ─── RSS feed: subscribe + immediate pull ───
  if (type === "rss" && url) {
    try {
      // Create the source
      const feedName = new URL(url).hostname.replace("www.", "");
      const source = await prisma.marketSource.upsert({
        where: { type_identifier: { type: "rss_feed", identifier: url } },
        create: {
          type: "rss_feed",
          name: feedName,
          url: url,
          identifier: url,
          active: true,
        },
        update: { active: true, url: url },
      });

      // Trigger immediate RSS pull via worker
      let articlesAdded = 0;
      try {
        const res = await fetch(`${WORKER_URL}/collect/rss`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": SYNC_SECRET,
          },
          signal: AbortSignal.timeout(90000),
        });
        const result = await res.json();
        // Worker returns { dataPoints: [...], ... } — count the array
        articlesAdded = Array.isArray(result.dataPoints)
          ? result.dataPoints.length
          : (result.dataPoints || 0);
      } catch {
        // Worker pull failed, but source is saved — will be picked up on next cron
      }

      return NextResponse.json({
        ok: true,
        source: { id: source.id, name: source.name },
        articlesAdded,
      });
    } catch (e) {
      return NextResponse.json(
        { error: `Failed to add RSS feed: ${e instanceof Error ? e.message : e}` },
        { status: 400 },
      );
    }
  }

  // ─── YouTube channel: resolve URL → subscribe ───
  if (type === "channel" && url) {
    try {
      const { channelId, channelName } = await resolveYouTubeChannelId(url);

      // Create/update the source
      const source = await prisma.marketSource.upsert({
        where: { type_identifier: { type: "youtube_channel", identifier: channelId } },
        create: {
          type: "youtube_channel",
          name: channelName,
          url: `https://www.youtube.com/channel/${channelId}`,
          identifier: channelId,
          active: true,
        },
        update: { active: true, name: channelName },
      });

      return NextResponse.json({
        ok: true,
        channelName,
        channelId,
        source: { id: source.id, name: source.name },
      });
    } catch (e) {
      return NextResponse.json(
        { error: `Failed to resolve channel: ${e instanceof Error ? e.message : e}` },
        { status: 400 },
      );
    }
  }

  // ─── Manual note: create directly ───
  if (type === "note" && text) {
    const dp = await prisma.marketDataPoint.create({
      data: {
        type: "manual_note",
        title: title || "Manual Note",
        scope: "national",
        rawContent: text,
        summary: text.substring(0, 500),
        tags: ["manual"],
      },
    });
    return NextResponse.json({ ok: true, dataPoint: dp });
  }

  return NextResponse.json({ error: "Invalid type or missing fields" }, { status: 400 });
}
