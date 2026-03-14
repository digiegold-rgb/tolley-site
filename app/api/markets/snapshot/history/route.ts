import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/snapshot/history?days=30
 * Returns array of daily snapshots for charts.
 */
export async function GET(request: NextRequest) {
  const days = Math.min(
    parseInt(request.nextUrl.searchParams.get("days") || "30", 10),
    365
  );
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshots = await prisma.marketSnapshot.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      nationalHealth: true,
      localKcHealth: true,
      mortgage30yr: true,
      mortgage15yr: true,
      treasury10yr: true,
      treasury30yr: true,
      unemployment: true,
      cpi: true,
      consumerSentiment: true,
      housingStarts: true,
      momentum: true,
      healthDelta: true,
      kcHealthDelta: true,
      sentimentBullPct: true,
      sentimentBearPct: true,
      articleCount: true,
      tickers: true,
      dataPointCount: true,
      signalCount: true,
    },
  });

  return NextResponse.json({
    snapshots: snapshots.map((s) => ({
      ...s,
      date: s.date.toISOString(),
    })),
  });
}
