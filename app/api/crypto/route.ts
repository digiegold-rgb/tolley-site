import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const [snapshot, trades, strategies] = await Promise.all([
      prisma.cryptoSnapshot.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.cryptoTrade.count({ where: { status: "closed" } }),
      prisma.cryptoStrategy.findMany(),
    ]);

    return NextResponse.json({
      snapshot: snapshot
        ? {
            equity: snapshot.equity,
            cash: snapshot.cash,
            unrealizedPnl: snapshot.unrealizedPnl,
            realizedPnl: snapshot.realizedPnl,
            openPositions: snapshot.openPositions,
            regime: snapshot.regime,
            mode: snapshot.engineMode,
            updatedAt: snapshot.createdAt.toISOString(),
          }
        : null,
      totalTrades: trades,
      strategies: strategies.map((s) => ({
        name: s.name,
        status: s.status,
        totalTrades: s.totalTrades,
        totalPnl: s.totalPnl,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
