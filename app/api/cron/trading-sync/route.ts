import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const ENGINE_CONFIGS: { assetClass: string; url: string }[] = [
  { assetClass: "crypto", url: process.env.CRYPTO_ENGINE_URL || "http://localhost:8950" },
  { assetClass: "stocks_conservative", url: process.env.STOCKS_CONSERVATIVE_ENGINE_URL || "http://localhost:8951" },
  { assetClass: "stocks_aggressive", url: process.env.STOCKS_AGGRESSIVE_ENGINE_URL || "http://localhost:8952" },
  { assetClass: "polymarket", url: process.env.POLYMARKET_ENGINE_URL || "http://localhost:8953" },
];

export async function GET(request: NextRequest) {
  const cronOk =
    process.env.CRON_SECRET &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!cronOk && !syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, { ok: boolean; error?: string }> = {};

  for (const engine of ENGINE_CONFIGS) {
    try {
      // 1. Fetch engine status
      const statusRes = await fetch(`${engine.url}/status`, {
        headers: { "x-sync-secret": SYNC_SECRET },
        signal: AbortSignal.timeout(15000),
      });

      if (!statusRes.ok) {
        results[engine.assetClass] = { ok: false, error: `Engine returned ${statusRes.status}` };
        continue;
      }

      const status = await statusRes.json();

      // 2. Save snapshot
      await prisma.tradingSnapshot.create({
        data: {
          assetClass: engine.assetClass,
          equity: status.equity || 0,
          cash: status.cash || 0,
          unrealizedPnl: status.unrealized_pnl || 0,
          realizedPnl: status.realized_pnl || 0,
          openPositions: status.open_positions || 0,
          regime: status.regime || null,
          engineMode: status.mode || "paper",
          metadata: {
            prices: status.prices,
            strategies: status.strategies,
            asset_class: status.asset_class,
          },
        },
      });

      // 3. Sync closed trades
      let tradesSynced = 0;
      try {
        const tradesRes = await fetch(`${engine.url}/trades?limit=50`, {
          headers: { "x-sync-secret": SYNC_SECRET },
          signal: AbortSignal.timeout(10000),
        });

        if (tradesRes.ok) {
          const { trades } = await tradesRes.json();
          for (const t of trades || []) {
            const existing = await prisma.tradingTrade.findFirst({
              where: {
                assetClass: engine.assetClass,
                symbol: t.symbol,
                entryPrice: t.entry_price,
                enteredAt: new Date(t.entered_at),
              },
            });

            if (!existing && t.status === "closed") {
              await prisma.tradingTrade.create({
                data: {
                  assetClass: engine.assetClass,
                  symbol: t.symbol,
                  side: t.side,
                  strategy: t.strategy || "unknown",
                  entryPrice: t.entry_price,
                  exitPrice: t.exit_price || null,
                  size: t.size,
                  pnl: t.pnl || null,
                  pnlPct: t.pnl_pct || null,
                  fees: t.fees || 0,
                  status: t.status,
                  exitReason: t.exit_reason || null,
                  regime: t.regime || null,
                  enteredAt: new Date(t.entered_at),
                  exitedAt: t.exited_at ? new Date(t.exited_at) : null,
                  metadata: {
                    asset_class: engine.assetClass,
                  },
                },
              });
              tradesSynced++;
            }
          }
        }
      } catch (e) {
        console.error(`[trading-sync] Trades fetch failed for ${engine.assetClass}:`, e);
      }

      results[engine.assetClass] = { ok: true };
    } catch (e) {
      results[engine.assetClass] = { ok: false, error: String(e) };
    }
  }

  // Prune old snapshots (keep 30 days)
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.tradingSnapshot.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
  } catch (e) {
    console.error("[trading-sync] Snapshot pruning failed:", e);
  }

  return NextResponse.json({
    ok: true,
    engines: results,
    synced: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
