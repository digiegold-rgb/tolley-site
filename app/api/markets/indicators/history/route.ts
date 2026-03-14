import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/indicators/history?tag=unrate&days=90
 * Returns time-series for a specific FRED indicator from MarketDataPoint.
 */
export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get("tag");
  if (!tag) {
    return NextResponse.json({ error: "tag parameter required" }, { status: 400 });
  }

  const days = Math.min(
    parseInt(request.nextUrl.searchParams.get("days") || "90", 10),
    365
  );
  const since = new Date();
  since.setDate(since.getDate() - days);

  const dataPoints = await prisma.marketDataPoint.findMany({
    where: {
      type: "economic_indicator",
      tags: { has: tag },
      createdAt: { gte: since },
      numericValue: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      numericValue: true,
      previousValue: true,
      changePercent: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    tag,
    points: dataPoints.map((d) => ({
      value: d.numericValue,
      previousValue: d.previousValue,
      changePercent: d.changePercent,
      date: d.createdAt.toISOString(),
    })),
  });
}
