import { prisma } from "@/lib/prisma";
import { requireAdminPageSession } from "@/lib/admin-auth";
import UnifiedDashboard from "@/components/trading/UnifiedDashboard";
import "../crypto/crypto.css";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const ASSET_CLASSES = ["crypto", "stocks_conservative", "stocks_aggressive", "polymarket"] as const;

export default async function TradingPage() {
  await requireAdminPageSession("/trading");

  let snapshots: Record<string, any> = {};
  let capitalTotals = { moneyIn: 0, moneyOut: 0 };

  try {
    // Get latest snapshot for each asset class
    const snapshotResults = await Promise.all(
      ASSET_CLASSES.map((ac) =>
        prisma.tradingSnapshot.findFirst({
          where: { assetClass: ac },
          orderBy: { createdAt: "desc" },
        })
      )
    );

    for (let i = 0; i < ASSET_CLASSES.length; i++) {
      const s = snapshotResults[i];
      if (s) {
        snapshots[ASSET_CLASSES[i]] = {
          equity: s.equity,
          cash: s.cash,
          unrealizedPnl: s.unrealizedPnl,
          realizedPnl: s.realizedPnl,
          openPositions: s.openPositions,
          regime: s.regime,
          engineMode: s.engineMode,
          metadata: s.metadata as Record<string, any> | null,
          createdAt: s.createdAt.toISOString(),
        };
      }
    }

    // Capital flow totals
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

    capitalTotals = {
      moneyIn: deposits._sum.amount || 0,
      moneyOut: withdrawals._sum.amount || 0,
    };
  } catch (e) {
    console.error("[trading] Failed to load data:", e);
  }

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-white/30 hover:text-white/50">tolley.io</a>
            <span className="text-white/10">/</span>
            <span className="text-sm font-medium text-amber-400">Trading Platform</span>
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
            <span className="text-amber-400">Multi-Asset</span> Trading Platform
          </h1>
          <p className="text-sm text-white/40">
            Autonomous AI-powered trading across crypto, stocks, and prediction markets.
          </p>
        </div>

        <UnifiedDashboard
          initialSnapshots={snapshots}
          initialCapital={capitalTotals}
        />

        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-white/20">
            Multi-Asset Trading Platform — Not financial advice. Paper trading mode.
          </p>
        </div>
      </div>
    </div>
  );
}
