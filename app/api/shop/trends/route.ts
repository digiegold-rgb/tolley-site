import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "active";
  const signalType = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  if (signalType) where.signalType = signalType;

  const trends = await prisma.trendSignal.findMany({
    where,
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  // Stats
  const [activeCount, totalCount] = await Promise.all([
    prisma.trendSignal.count({ where: { status: "active" } }),
    prisma.trendSignal.count(),
  ]);

  // Signal type breakdown
  const byType = await prisma.trendSignal.groupBy({
    by: ["signalType"],
    where: { status: "active" },
    _count: true,
  });

  return NextResponse.json({
    trends,
    stats: {
      active: activeCount,
      total: totalCount,
      byType: byType.map((t) => ({ type: t.signalType, count: t._count })),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const trend = await prisma.trendSignal.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(trend);
}
