import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const trades = await prisma.cryptoTrade.findMany({
    orderBy: { enteredAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json({
    trades: trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      strategy: t.strategy,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      size: t.size,
      pnl: t.pnl,
      pnlPct: t.pnlPct,
      fees: t.fees,
      status: t.status,
      exitReason: t.exitReason,
      regime: t.regime,
      enteredAt: t.enteredAt.toISOString(),
      exitedAt: t.exitedAt?.toISOString() || null,
    })),
  });
}
