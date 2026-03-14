"use client";

interface StrategyInfo {
  id: string;
  name: string;
  displayName: string;
  status: string;
  regime: string | null;
  winRate: number | null;
  sharpe: number | null;
  totalTrades: number;
  totalPnl: number;
  config: Record<string, any> | null;
  updatedAt: string;
}

interface Props {
  strategies: StrategyInfo[];
  liveStrategies?: Record<string, { active: boolean; trades: number; win_rate: number }>;
  regime: string;
}

export default function StrategyCards({ strategies, liveStrategies, regime }: Props) {
  const allStrategies = strategies.length > 0
    ? strategies
    : [
        { id: "1", name: "trend_following", displayName: "Trend Following (20/55 SMA)", status: "active", regime: "TRENDING_UP", winRate: null, sharpe: null, totalTrades: 0, totalPnl: 0, config: null, updatedAt: "" },
        { id: "2", name: "mean_reversion", displayName: "Mean Reversion (BB + RSI)", status: "active", regime: "RANGING", winRate: null, sharpe: null, totalTrades: 0, totalPnl: 0, config: null, updatedAt: "" },
        { id: "3", name: "dca_dynamic", displayName: "DCA Dynamic (SMA-gated)", status: "active", regime: null, winRate: null, sharpe: null, totalTrades: 0, totalPnl: 0, config: null, updatedAt: "" },
        { id: "4", name: "funding_arb", displayName: "Funding Rate Arb", status: "active", regime: null, winRate: null, sharpe: null, totalTrades: 0, totalPnl: 0, config: null, updatedAt: "" },
      ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {allStrategies.map((s) => {
        const live = liveStrategies?.[s.name];
        const isActive = live?.active ?? s.status === "active";
        const trades = live?.trades ?? s.totalTrades;
        const winRate = live?.win_rate ?? s.winRate;

        return (
          <div key={s.id} className={`crypto-card ${isActive ? "" : "opacity-50"}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">{s.displayName}</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  isActive
                    ? "bg-green-500/20 text-green-400"
                    : "bg-white/5 text-white/30"
                }`}
              >
                {isActive ? "Active" : "Paused"}
              </span>
            </div>
            {s.regime && (
              <div className="text-[10px] text-white/30 mb-3">
                Runs in: <span className="text-amber-400/60">{s.regime.replace("_", " ")}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] text-white/30 uppercase">Trades</div>
                <div className="text-lg font-bold text-white">{trades}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/30 uppercase">Win Rate</div>
                <div className="text-lg font-bold text-white">
                  {winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/30 uppercase">P&L</div>
                <div
                  className={`text-lg font-bold ${
                    s.totalPnl >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(2)}
                </div>
              </div>
            </div>
            {s.sharpe != null && (
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs">
                <span className="text-white/30">Sharpe Ratio</span>
                <span className="text-amber-400">{s.sharpe.toFixed(2)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
