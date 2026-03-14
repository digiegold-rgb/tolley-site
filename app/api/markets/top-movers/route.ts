import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/top-movers?limit=10
 * Returns highest-impact data points today.
 */
export async function GET(request: NextRequest) {
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "10", 10),
    50
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const movers = await prisma.marketDataPoint.findMany({
    where: {
      createdAt: { gte: today },
      impactScore: { not: null },
    },
    orderBy: { impactScore: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      numericValue: true,
      changePercent: true,
      impactScore: true,
      signal: true,
      tags: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    movers: movers.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
