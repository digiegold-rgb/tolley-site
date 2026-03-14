import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

  const engineUrl = process.env.CRYPTO_ENGINE_URL || "http://localhost:8950";
  const syncSecret = process.env.SYNC_SECRET || "";

  try {
    // 1. Fetch engine status
    const statusRes = await fetch(`${engineUrl}/status`, {
      headers: { "x-sync-secret": syncSecret },
      signal: AbortSignal.timeout(15000),
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: "Engine unavailable" }, { status: 502 });
    }

    const status = await statusRes.json();

    // 2. Save snapshot
    await prisma.cryptoSnapshot.create({
      data: {
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
        },
      },
    });

    // 3. Sync strategies
    if (status.strategies) {
      for (const [name, data] of Object.entries(status.strategies as Record<string, any>)) {
        await prisma.cryptoStrategy.upsert({
          where: { name },
          update: {
            status: data.active ? "active" : "paused",
            winRate: data.win_rate || null,
            totalTrades: data.trades || 0,
          },
          create: {
            name,
            displayName: name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            status: data.active ? "active" : "paused",
            winRate: data.win_rate || null,
            totalTrades: data.trades || 0,
          },
        });
      }
    }

    // 4. Sync closed trades
    const tradesRes = await fetch(`${engineUrl}/trades?limit=20`, {
      headers: { "x-sync-secret": syncSecret },
      signal: AbortSignal.timeout(10000),
    });

    if (tradesRes.ok) {
      const { trades } = await tradesRes.json();
      for (const t of trades || []) {
        // Use entered_at + symbol as unique key to avoid duplicates
        const existing = await prisma.cryptoTrade.findFirst({
          where: {
            symbol: t.symbol,
            entryPrice: t.entry_price,
            enteredAt: new Date(t.entered_at),
          },
        });

        if (!existing && t.status === "closed") {
          await prisma.cryptoTrade.create({
            data: {
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
            },
          });
        }
      }
    }

    // 5. Prune old snapshots (keep 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.cryptoSnapshot.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });

    return NextResponse.json({ ok: true, synced: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
