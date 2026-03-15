import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const ENGINE_URLS: Record<string, string> = {
  crypto: process.env.CRYPTO_ENGINE_URL || "http://localhost:8950",
  stocks_conservative: process.env.STOCKS_CONSERVATIVE_ENGINE_URL || "http://localhost:8951",
  stocks_aggressive: process.env.STOCKS_AGGRESSIVE_ENGINE_URL || "http://localhost:8952",
  polymarket: process.env.POLYMARKET_ENGINE_URL || "http://localhost:8953",
};

const CRYPTO_ENGINES = ["crypto", "polymarket"];
const US_ENGINES = ["stocks_conservative", "stocks_aggressive"];

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  // Fan-out to all 4 engines
  const engineStatuses: Record<string, any> = {};

  const results = await Promise.allSettled(
    Object.entries(ENGINE_URLS).map(async ([ac, url]) => {
      try {
        const res = await fetch(`${url}/status`, {
          headers: { "x-sync-secret": SYNC_SECRET },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          return { ac, data, online: true };
        }
        return { ac, data: null, online: false };
      } catch {
        return { ac, data: null, online: false };
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { ac, data, online } = result.value;
      engineStatuses[ac] = { ...data, online };
    }
  }

  // Capital flow totals
  let moneyIn = 0;
  let moneyOut = 0;

  try {
    const [deposits, withdrawals] = await Promise.all([
      prisma.tradingCapitalFlow.aggregate({
        where: { flowType: "deposit" },
        _sum: { amount: true },
      }),
      prisma.tradingCapitalFlow.aggregate({
        where: { flowType: "withdrawal" },
        _sum: { amount: true },
      }),
    ]);
    moneyIn = deposits._sum.amount || 0;
    moneyOut = withdrawals._sum.amount || 0;
  } catch (e) {
    console.error("[trading/summary] Capital flow query failed:", e);
  }

  // Calculate combined P&L from engine statuses
  let totalRealizedPnl = 0;
  let totalUnrealizedPnl = 0;
  for (const [, status] of Object.entries(engineStatuses)) {
    if (status.online) {
      totalRealizedPnl += status.realized_pnl || 0;
      totalUnrealizedPnl += status.unrealized_pnl || 0;
    }
  }

  // Category breakdowns
  const buildCategoryPnl = (engines: string[]) => {
    let deposits = 0, pnl = 0, withdrawals = 0;
    for (const e of engines) {
      const s = engineStatuses[e];
      if (s?.online) {
        pnl += (s.realized_pnl || 0) + (s.unrealized_pnl || 0);
      }
    }
    return { engines, deposits, pnl, withdrawals };
  };

  return NextResponse.json({
    engines: engineStatuses,
    capital: {
      moneyIn,
      moneyOut,
      totalRealizedPnl,
      totalUnrealizedPnl,
      combinedPnl: totalRealizedPnl + totalUnrealizedPnl,
    },
    categories: {
      crypto: buildCategoryPnl(CRYPTO_ENGINES),
      us: buildCategoryPnl(US_ENGINES),
    },
    timestamp: new Date().toISOString(),
  });
}
