import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/signals/history?days=30
 * Returns archived signals with accuracy scores.
 */
export async function GET(request: NextRequest) {
  const days = Math.min(
    parseInt(request.nextUrl.searchParams.get("days") || "30", 10),
    365
  );
  const since = new Date();
  since.setDate(since.getDate() - days);

  const signals = await prisma.marketSignalArchive.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    signals: signals.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      archivedAt: s.archivedAt.toISOString(),
    })),
  });
}
