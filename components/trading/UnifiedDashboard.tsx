"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const ASSET_CLASSES = ["crypto", "stocks_conservative", "stocks_aggressive", "polymarket"] as const;
type AssetClass = (typeof ASSET_CLASSES)[number];

const ASSET_LABELS: Record<AssetClass, string> = {
  crypto: "Crypto",
  stocks_conservative: "Stocks Conservative",
  stocks_aggressive: "Stocks Aggressive",
  polymarket: "Polymarket",
};

const ASSET_ICONS: Record<AssetClass, string> = {
  crypto: "\u20BF",
  stocks_conservative: "\u2191",
  stocks_aggressive: "\u26A1",
  polymarket: "\u2696",
};

const CRYPTO_ENGINES: AssetClass[] = ["crypto", "polymarket"];
const US_ENGINES: AssetClass[] = ["stocks_conservative", "stocks_aggressive"];

interface EngineStatus {
  equity?: number;
  cash?: number;
  realized_pnl?: number;
  unrealized_pnl?: number;
  open_positions?: number;
  total_trades?: number;
  regime?: string;
  mode?: string;
  online: boolean;
  positions?: any[];
  strategies?: Record<string, any>;
  uptime_seconds?: number;
  cross_asset?: { vix_level?: number; vix_spike?: boolean; risk_regime?: string; fresh?: boolean };
  macro?: { economic_phase?: string; yield_curve_inverted?: boolean; fresh?: boolean };
  sentiment?: { score?: number; headline_count?: number };
  options_flow?: { market_bias?: string; symbols_scanned?: number; fresh?: boolean };
  insider_data?: { cluster_buys?: number; total_scanned?: number; fresh?: boolean };
  data_sources?: Record<string, any>;
}

interface Props {
  initialSnapshots: Record<string, any>;
  initialCapital: { moneyIn: number; moneyOut: number };
}

export default function UnifiedDashboard({ initialSnapshots, initialCapital }: Props) {
  const [engines, setEngines] = useState<Record<string, EngineStatus>>({});
  const [capital, setCapital] = useState(initialCapital);
  const [loading, setLoading] = useState(true);
  const [mirofishStatus, setMirofishStatus] = useState<{
    online: boolean;
    running: number;
    completed: number;
    cachedSignals: number;
    lastEvent?: string;
  }>({ online: false, running: 0, completed: 0, cachedSignals: 0 });

  // Build initial engine state from snapshots
  useEffect(() => {
    const initial: Record<string, EngineStatus> = {};
    for (const ac of ASSET_CLASSES) {
      const snap = initialSnapshots[ac];
      if (snap) {
        initial[ac] = {
          equity: snap.equity,
          cash: snap.cash,
          realized_pnl: snap.realizedPnl,
          unrealized_pnl: snap.unrealizedPnl,
          open_positions: snap.openPositions,
          regime: snap.regime,
          mode: snap.engineMode,
          online: false,
          strategies: snap.metadata?.strategies,
        };
      } else {
        initial[ac] = { online: false };
      }
    }
    setEngines(initial);
    setLoading(false);
  }, [initialSnapshots]);

  // Poll summary every 15s
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/trading/summary");
        if (res.ok) {
          const data = await res.json();
          setEngines(data.engines || {});
          setCapital({
            moneyIn: data.capital?.moneyIn || 0,
            moneyOut: data.capital?.moneyOut || 0,
          });
        }
      } catch {
        // Silent fail — keep existing data
      }

      // Fetch MiroFish status
      try {
        const simRes = await fetch("/api/trading/simulations?limit=5");
        if (simRes.ok) {
          const simData = await simRes.json();
          const sims = simData.simulations || [];
          const running = sims.filter((s: any) => ["running", "pending", "extracting"].includes(s.status)).length;
          const completed = sims.filter((s: any) => s.status === "completed").length;
          const lastCompleted = sims.find((s: any) => s.status === "completed");
          setMirofishStatus({
            online: true,
            running,
            completed,
            cachedSignals: lastCompleted?.signals?.signals ? Object.keys(lastCompleted.signals.signals).length : 0,
            lastEvent: lastCompleted?.event,
          });
        } else {
          setMirofishStatus((prev) => ({ ...prev, online: false }));
        }
      } catch {
        setMirofishStatus((prev) => ({ ...prev, online: false }));
      }
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 15000);
    return () => clearInterval(interval);
  }, []);

  // Compute totals
  const totalRealizedPnl = ASSET_CLASSES.reduce(
    (sum, ac) => sum + (engines[ac]?.realized_pnl || 0),
    0
  );
  const totalUnrealizedPnl = ASSET_CLASSES.reduce(
    (sum, ac) => sum + (engines[ac]?.unrealized_pnl || 0),
    0
  );
  const combinedPnl = totalRealizedPnl + totalUnrealizedPnl;

  // Category totals
  const cryptoMoneyIn = CRYPTO_ENGINES.reduce(
    (sum, ac) => sum + (engines[ac]?.equity || 0),
    0
  );
  const usMoneyIn = US_ENGINES.reduce(
    (sum, ac) => sum + (engines[ac]?.equity || 0),
    0
  );
  const cryptoPnl = CRYPTO_ENGINES.reduce(
    (sum, ac) => sum + (engines[ac]?.realized_pnl || 0) + (engines[ac]?.unrealized_pnl || 0),
    0
  );
  const usPnl = US_ENGINES.reduce(
    (sum, ac) => sum + (engines[ac]?.realized_pnl || 0) + (engines[ac]?.unrealized_pnl || 0),
    0
  );

  const fmt = (n: number) =>
    "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSign = (n: number) =>
    (n >= 0 ? "+" : "") +
    "$" +
    Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/20 text-sm">Loading trading platform...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top 3 summary boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Money In */}
        <div className="crypto-card crypto-glow">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
            Total Money In
          </div>
          <div className="text-3xl font-bold text-white">{fmt(capital.moneyIn)}</div>
          <div className="flex gap-3 mt-1">
            <span className="text-xs text-white/30">
              Crypto: <span className="text-amber-400/60">{fmt(cryptoMoneyIn)}</span>
            </span>
            <span className="text-xs text-white/30">
              US: <span className="text-amber-400/60">{fmt(usMoneyIn)}</span>
            </span>
          </div>
        </div>

        {/* Profit & Loss */}
        <div className="crypto-card crypto-glow">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
            Combined P&L
          </div>
          <div
            className={`text-3xl font-bold ${
              combinedPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {fmtSign(combinedPnl)}
          </div>
          <div className="flex gap-4 mt-1">
            <span className="text-xs text-white/30">
              Crypto:{" "}
              <span className={cryptoPnl >= 0 ? "text-green-400/60" : "text-red-400/60"}>
                {fmtSign(cryptoPnl)}
              </span>
            </span>
            <span className="text-xs text-white/30">
              US:{" "}
              <span className={usPnl >= 0 ? "text-green-400/60" : "text-red-400/60"}>
                {fmtSign(usPnl)}
              </span>
            </span>
          </div>
        </div>

        {/* Money Out */}
        <div className="crypto-card crypto-glow">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
            Total Money Out
          </div>
          <div className="text-3xl font-bold text-white">{fmt(capital.moneyOut)}</div>
          <div className="flex gap-3 mt-1">
            <span className="text-xs text-white/30">
              Realized:{" "}
              <span className={totalRealizedPnl >= 0 ? "text-green-400/60" : "text-red-400/60"}>
                {fmtSign(totalRealizedPnl)}
              </span>
            </span>
            <span className="text-xs text-white/30">
              Unrealized:{" "}
              <span className={totalUnrealizedPnl >= 0 ? "text-green-400/60" : "text-red-400/60"}>
                {fmtSign(totalUnrealizedPnl)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* MiroFish simulation card */}
      <Link
        href="/trading/simulations"
        className="crypto-card group cursor-pointer transition-all hover:border-amber-500/30"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-lg font-bold">
              {"\uD83D\uDC1F"}
            </div>
            <div>
              <h3 className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">
                MiroFish Simulations
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    mirofishStatus.online ? "bg-green-400 pulse-gold" : "bg-red-400/50"
                  }`}
                />
                <span className="text-[10px] text-white/30">
                  {mirofishStatus.online ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30">
            AI Sim
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
          <div>
            <div className="text-[10px] text-white/30 uppercase">Active Sims</div>
            <div className="text-sm font-medium text-white">{mirofishStatus.running}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 uppercase">Completed</div>
            <div className="text-sm font-medium text-white">{mirofishStatus.completed}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 uppercase">Signals</div>
            <div className="text-sm font-medium text-amber-400/80">{mirofishStatus.cachedSignals}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 uppercase">Last Event</div>
            <div className="text-sm font-medium text-white/60 truncate">
              {mirofishStatus.lastEvent || "--"}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/5 text-center">
          <span className="text-[10px] text-white/20 group-hover:text-amber-400/40 transition-colors">
            View simulations &rarr;
          </span>
        </div>
      </Link>

      {/* Engine cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ASSET_CLASSES.map((ac) => {
          const engine = engines[ac] || {};
          const online = engine.online ?? false;
          const equity = engine.equity ?? 0;
          const positions = engine.open_positions ?? engine.positions?.length ?? 0;
          const totalTrades = engine.total_trades ?? 0;
          const regime = engine.regime ?? "UNKNOWN";
          const mode = engine.mode ?? "paper";
          const strategyCount = engine.strategies
            ? Object.keys(engine.strategies).length
            : 0;
          const pnl = (engine.realized_pnl || 0) + (engine.unrealized_pnl || 0);

          return (
            <a
              key={ac}
              href={`/trading/${ac}`}
              className="crypto-card group cursor-pointer transition-all hover:border-amber-500/30"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg font-bold">
                    {ASSET_ICONS[ac]}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">
                      {ASSET_LABELS[ac]}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          online ? "bg-green-400 pulse-gold" : "bg-red-400/50"
                        }`}
                      />
                      <span className="text-[10px] text-white/30">
                        {online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                    mode === "live"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {mode}
                </span>
              </div>

              {/* Equity */}
              <div className="text-2xl font-bold text-white mb-1">{fmt(equity)}</div>
              <div
                className={`text-sm font-medium mb-4 ${
                  pnl >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {fmtSign(pnl)}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                <div>
                  <div className="text-[10px] text-white/30 uppercase">Positions</div>
                  <div className="text-sm font-medium text-white">{positions}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/30 uppercase">Trades</div>
                  <div className="text-sm font-medium text-white">{totalTrades}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/30 uppercase">Regime</div>
                  <div className="text-sm font-medium text-amber-400/80 truncate">
                    {regime.replace(/_/g, " ")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-white/30 uppercase">Strategies</div>
                  <div className="text-sm font-medium text-white">{strategyCount}</div>
                </div>
              </div>

              {/* Data Feed Badges */}
              {(ac === "stocks_conservative" || ac === "stocks_aggressive") && engine.cross_asset && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30">VIX</span>
                    <span className={`text-[10px] font-medium ${engine.cross_asset.vix_spike ? "text-red-400" : (engine.cross_asset.vix_level ?? 0) > 18 ? "text-orange-400" : "text-green-400"}`}>
                      {engine.cross_asset.vix_level?.toFixed(1) ?? "--"}{engine.cross_asset.vix_spike ? " SPIKE" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30">Risk</span>
                    <span className={`text-[10px] font-medium ${
                      engine.cross_asset.risk_regime === "RISK_ON" ? "text-green-400"
                      : engine.cross_asset.risk_regime === "RISK_OFF" ? "text-red-400"
                      : "text-orange-400"
                    }`}>
                      {engine.cross_asset.risk_regime?.replace(/_/g, " ") ?? "--"}
                    </span>
                  </div>
                  {engine.sentiment?.score != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30">Sentiment</span>
                      <span className={`text-[10px] font-medium ${engine.sentiment.score > 0.2 ? "text-green-400" : engine.sentiment.score < -0.2 ? "text-red-400" : "text-white/40"}`}>
                        {engine.sentiment.score > 0 ? "+" : ""}{engine.sentiment.score.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {engine.options_flow?.market_bias && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30">Options</span>
                      <span className={`text-[10px] font-medium capitalize ${
                        engine.options_flow.market_bias === "bullish" ? "text-green-400"
                        : engine.options_flow.market_bias === "bearish" ? "text-red-400"
                        : "text-white/40"
                      }`}>
                        {engine.options_flow.market_bias}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Hover hint */}
              <div className="mt-4 pt-3 border-t border-white/5 text-center">
                <span className="text-[10px] text-white/20 group-hover:text-amber-400/40 transition-colors">
                  View details &rarr;
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
