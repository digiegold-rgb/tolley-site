import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const strategies = await prisma.cryptoStrategy.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    strategies: strategies.map((s) => ({
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      status: s.status,
      regime: s.regime,
      winRate: s.winRate,
      sharpe: s.sharpe,
      totalTrades: s.totalTrades,
      totalPnl: s.totalPnl,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}
