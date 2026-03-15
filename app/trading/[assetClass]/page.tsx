import { prisma } from "@/lib/prisma";
import { requireAdminPageSession } from "@/lib/admin-auth";
import { notFound } from "next/navigation";
import AssetPortal from "@/components/trading/AssetPortal";
import "../../crypto/crypto.css";

export const dynamic = "force-dynamic";
export const revalidate = 30;

const VALID_ASSET_CLASSES = ["crypto", "stocks_conservative", "stocks_aggressive", "polymarket"] as const;
type AssetClass = (typeof VALID_ASSET_CLASSES)[number];

const ASSET_LABELS: Record<AssetClass, string> = {
  crypto: "Crypto",
  stocks_conservative: "Stocks Conservative",
  stocks_aggressive: "Stocks Aggressive",
  polymarket: "Polymarket",
};

interface PageProps {
  params: Promise<{ assetClass: string }>;
}

export default async function AssetClassPage({ params }: PageProps) {
  const { assetClass } = await params;

  if (!VALID_ASSET_CLASSES.includes(assetClass as AssetClass)) {
    notFound();
  }

  await requireAdminPageSession(`/trading/${assetClass}`);

  const ac = assetClass as AssetClass;
  let latestSnapshot = null;
  let recentTrades: any[] = [];
  let strategies: any[] = [];

  try {
    [latestSnapshot, recentTrades] = await Promise.all([
      prisma.tradingSnapshot.findFirst({
        where: { assetClass: ac },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tradingTrade.findMany({
        where: { assetClass: ac },
        orderBy: { enteredAt: "desc" },
        take: 50,
      }),
    ]);
  } catch (e) {
    console.error(`[trading/${ac}] Failed to load data:`, e);
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

  // Extract strategies from snapshot metadata if available
  if (snapshot?.metadata?.strategies) {
    strategies = Object.entries(snapshot.metadata.strategies).map(
      ([name, data]: [string, any]) => ({
        name,
        displayName: name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        active: data.active ?? true,
        winRate: data.win_rate ?? null,
        sharpe: data.sharpe ?? null,
        trades: data.trades ?? 0,
        pnl: data.pnl ?? 0,
      })
    );
  }

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

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-white/30 hover:text-white/50">tolley.io</a>
            <span className="text-white/10">/</span>
            <a href="/trading" className="text-xs text-white/40 hover:text-white/60">Trading</a>
            <span className="text-white/10">/</span>
            <span className="text-sm font-medium text-amber-400">{ASSET_LABELS[ac]}</span>
          </div>
          <div className="flex items-center gap-3">
            {VALID_ASSET_CLASSES.filter((c) => c !== ac).map((c) => (
              <a
                key={c}
                href={`/trading/${c}`}
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                {ASSET_LABELS[c]}
              </a>
            ))}
          </div>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            <span className="text-amber-400">{ASSET_LABELS[ac]}</span> Trading Engine
          </h1>
          <p className="text-sm text-white/40">
            Autonomous AI-powered {ASSET_LABELS[ac].toLowerCase()} trading engine.
          </p>
        </div>

        <AssetPortal
          assetClass={ac}
          initialSnapshot={snapshot}
          initialTrades={serializedTrades}
          initialStrategies={strategies}
        />

        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-white/20">
            {ASSET_LABELS[ac]} Engine — Not financial advice. Paper trading mode.
          </p>
        </div>
      </div>
    </div>
  );
}
