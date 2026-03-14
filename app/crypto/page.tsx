import { prisma } from "@/lib/prisma";
import { requireAdminPageSession } from "@/lib/admin-auth";
import CryptoPortal from "@/components/crypto/CryptoPortal";
import "./crypto.css";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function CryptoPage() {
  await requireAdminPageSession("/crypto");

  let latestSnapshot = null;
  let strategies: any[] = [];
  let recentTrades: any[] = [];
  let predictions: any[] = [];

  try {
    [latestSnapshot, strategies, recentTrades, predictions] = await Promise.all([
      prisma.cryptoSnapshot.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.cryptoStrategy.findMany({ orderBy: { name: "asc" } }),
      prisma.cryptoTrade.findMany({
        orderBy: { enteredAt: "desc" },
        take: 50,
      }),
      prisma.cryptoPrediction.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
  } catch (e) {
    console.error("[crypto] Failed to load data:", e);
  }

  const snapshot = latestSnapshot
    ? {
        equity: latestSnapshot.equity,
        cash: latestSnapshot.cash,
        unrealizedPnl: latestSnapshot.unrealizedPnl,
        realizedPnl: latestSnapshot.realizedPnl,
        openPositions: latestSnapshot.openPositions,
        regime: latestSnapshot.regime,
        engineMode: latestSnapshot.engineMode,
        metadata: latestSnapshot.metadata as Record<string, any> | null,
        createdAt: latestSnapshot.createdAt.toISOString(),
      }
    : null;

  const serializedStrategies = strategies.map((s) => ({
    id: s.id,
    name: s.name,
    displayName: s.displayName,
    status: s.status,
    regime: s.regime,
    winRate: s.winRate,
    sharpe: s.sharpe,
    totalTrades: s.totalTrades,
    totalPnl: s.totalPnl,
    config: s.config as Record<string, any> | null,
    updatedAt: s.updatedAt.toISOString(),
  }));

  const serializedTrades = recentTrades.map((t) => ({
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
  }));

  const serializedPredictions = predictions.map((p) => ({
    id: p.id,
    asset: p.asset,
    direction: p.direction,
    targetPrice: p.targetPrice,
    confidence: p.confidence,
    rationale: p.rationale,
    currentPrice: p.currentPrice,
    actualPrice: p.actualPrice,
    accuracy: p.accuracy,
    status: p.status,
    targetDate: p.targetDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-white/30 hover:text-white/50">tolley.io</a>
            <span className="text-white/10">/</span>
            <span className="text-sm font-medium text-amber-400">Digital Gold</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/markets" className="text-xs text-white/40 hover:text-white/60 transition-colors">
              Markets
            </a>
            <a href="/leads/dashboard" className="text-xs text-white/40 hover:text-white/60 transition-colors">
              Dashboard
            </a>
          </div>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            <span className="text-amber-400">Digital Gold</span> Trading Engine
          </h1>
          <p className="text-sm text-white/40">
            Autonomous AI-powered crypto trading — 4 strategies, regime detection, paper trading mode.
          </p>
        </div>

        <CryptoPortal
          initialSnapshot={snapshot}
          initialStrategies={serializedStrategies}
          initialTrades={serializedTrades}
          initialPredictions={serializedPredictions}
        />

        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-white/20">
            Digital Gold Engine — Not financial advice. Paper trading mode.
          </p>
        </div>
      </div>
    </div>
  );
}
