import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/sentiment/history?scope=national&days=30
 * Returns daily aggregated sentiment: {date, total, bullish, neutral, bearish, avgSentiment}
 */
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") || "national";
  const days = Math.min(
    parseInt(request.nextUrl.searchParams.get("days") || "30", 10),
    365
  );
  const since = new Date();
  since.setDate(since.getDate() - days);

  const articles = await prisma.marketDataPoint.findMany({
    where: {
      type: { in: ["article_summary", "video_analysis"] },
      createdAt: { gte: since },
      ...(scope !== "all" ? { scope } : {}),
    },
    select: {
      sentiment: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate by day
  const byDay: Record<string, { total: number; bullish: number; neutral: number; bearish: number; sumSentiment: number }> = {};

  for (const a of articles) {
    const day = a.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) {
      byDay[day] = { total: 0, bullish: 0, neutral: 0, bearish: 0, sumSentiment: 0 };
    }
    byDay[day].total++;
    const s = a.sentiment ?? 0;
    byDay[day].sumSentiment += s;
    if (s > 0.2) byDay[day].bullish++;
    else if (s < -0.2) byDay[day].bearish++;
    else byDay[day].neutral++;
  }

  const result = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      total: d.total,
      bullish: d.bullish,
      neutral: d.neutral,
      bearish: d.bearish,
      avgSentiment: d.total > 0 ? d.sumSentiment / d.total : 0,
    }));

  return NextResponse.json({ sentiment: result });
}
