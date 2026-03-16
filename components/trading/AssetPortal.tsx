"use client";

import { useState, useEffect } from "react";

type Tab = "overview" | "strategies" | "trades" | "predictions" | "datafeeds" | "market" | "optimizer" | "workflow";

interface Snapshot {
  equity: number;
  cash: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openPositions: number;
  regime: string | null;
  engineMode: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface TradeInfo {
  id: string;
  symbol: string;
  side: string;
  strategy: string;
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  pnl: number | null;
  pnlPct: number | null;
  fees: number;
  status: string;
  exitReason: string | null;
  regime: string | null;
  enteredAt: string;
  exitedAt: string | null;
}

interface StrategyInfo {
  name: string;
  displayName: string;
  active: boolean;
  winRate: number | null;
  sharpe: number | null;
  trades: number;
  pnl: number;
}

interface Props {
  assetClass: string;
  initialSnapshot: Snapshot | null;
  initialTrades: TradeInfo[];
  initialStrategies: StrategyInfo[];
}

export default function AssetPortal({
  assetClass,
  initialSnapshot,
  initialTrades,
  initialStrategies,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [trades, setTrades] = useState(initialTrades);
  const [strategies, setStrategies] = useState(initialStrategies);
  const [liveData, setLiveData] = useState<any>(null);
  const [engineOnline, setEngineOnline] = useState(false);
  const [optimizerHistory, setOptimizerHistory] = useState<any[]>([]);

  // Poll live engine data every 15s
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/trading/${assetClass}/live`);
        if (res.ok) {
          const data = await res.json();
          setLiveData(data);
          setEngineOnline(true);

          if (data.strategies) {
            const liveStrats = Object.entries(data.strategies).map(
              ([name, d]: [string, any]) => ({
                name,
                displayName: name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                active: d.active ?? true,
                winRate: d.win_rate ?? null,
                sharpe: d.sharpe ?? null,
                trades: d.trades ?? 0,
                pnl: d.pnl ?? 0,
              })
            );
            setStrategies(liveStrats);
          }
        } else {
          setEngineOnline(false);
        }
      } catch {
        setEngineOnline(false);
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 15000);
    return () => clearInterval(interval);
  }, [assetClass]);

  // Fetch optimizer history on tab switch
  useEffect(() => {
    if (tab !== "optimizer") return;
    const fetchOptimizer = async () => {
      try {
        const res = await fetch(`/api/trading/${assetClass}/live`);
        if (res.ok) {
          const data = await res.json();
          // Optimizer history would come from a dedicated endpoint
          // For now, we show what's available in status
        }
      } catch {}
    };
    fetchOptimizer();
  }, [tab, assetClass]);

  const currentEquity = liveData?.equity ?? snapshot?.equity ?? 0;
  const currentCash = liveData?.cash ?? snapshot?.cash ?? 0;
  const currentRegime = liveData?.regime ?? snapshot?.regime ?? "UNKNOWN";
  const currentMode = liveData?.mode ?? snapshot?.engineMode ?? "paper";
  const unrealizedPnl = liveData?.unrealized_pnl ?? snapshot?.unrealizedPnl ?? 0;
  const realizedPnl = liveData?.realized_pnl ?? snapshot?.realizedPnl ?? 0;
  const positions = liveData?.positions ?? [];
  const openPositionCount = liveData?.open_positions ?? positions.length ?? snapshot?.openPositions ?? 0;
  const initialCapital = 10000;
  const totalReturn = ((currentEquity - initialCapital) / initialCapital) * 100;
  const totalPnl = currentEquity - initialCapital;
  const invested = currentEquity - currentCash;
  const prices = liveData?.prices ?? snapshot?.metadata?.prices ?? {};
  const livePredictions = liveData?.predictions ?? {};
  const tvSignals = liveData?.tv_signals ?? {};

  // New data feeds
  const crossAsset = liveData?.cross_asset ?? {};
  const macro = liveData?.macro ?? {};
  const optionsFlow = liveData?.options_flow ?? {};
  const insiderData = liveData?.insider_data ?? {};
  const earningsData = liveData?.earnings_data ?? {};
  const sentimentScore = liveData?.sentiment?.score ?? 0;
  const dataSources = liveData?.data_sources ?? {};

  // Self-improving feedback loop
  const selfImproving = liveData?.self_improving ?? {};
  const strategyScores = selfImproving.strategy_scores ?? {};
  const disabledStrategies = selfImproving.disabled_strategies ?? {};
  const recentLessons = selfImproving.recent_lessons ?? [];
  const tradeLessonCount = selfImproving.trade_lessons ?? 0;

  const fmt = (n: number) =>
    "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSign = (n: number) =>
    (n >= 0 ? "+" : "") + fmt(Math.abs(n));

  const equityCurve: [string, number][] | null =
    liveData?.equity_curve && liveData.equity_curve.length > 2
      ? liveData.equity_curve
      : null;

  const dataFeedCount = Object.values(dataSources).filter((s: any) => s?.fresh || s?.enabled).length;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "strategies", label: "Strategies", count: strategies.length },
    { key: "trades", label: "Trades", count: trades.length },
    { key: "predictions", label: "Predictions", count: Object.keys(livePredictions).length },
    { key: "datafeeds", label: "Data Feeds", count: dataFeedCount },
    { key: "market", label: "Market Intel" },
    { key: "optimizer", label: "Optimizer" },
    { key: "workflow", label: "Workflow" },
  ];

  const closedTrades = trades.filter((t) => t.status === "closed");
  const closedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = closedTrades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = closedTrades.length > 0 ? wins / closedTrades.length : 0;

  return (
    <div>
      {/* Status bar */}
      <div className="crypto-card mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${engineOnline ? "bg-green-400 pulse-gold" : "bg-red-400/50"}`} />
          <span className="text-sm text-white/60">{engineOnline ? "Engine Online" : "Engine Offline"}</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${currentMode === "live" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
          Mode: {currentMode}
        </span>
        {liveData?.uptime_seconds && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs text-white/30">
              Uptime: {Math.floor(liveData.uptime_seconds / 3600)}h {Math.floor((liveData.uptime_seconds % 3600) / 60)}m
            </span>
          </>
        )}
        <div className="h-4 w-px bg-white/10" />
        <span className="text-xs text-white/30">
          Tracking: <span className="text-white/60">{liveData?.tracked_symbols ?? Object.keys(prices).length} symbols</span>
        </span>
        <div className="h-4 w-px bg-white/10" />
        <span className="text-xs text-white/30">
          Positions: <span className="text-white/60">{openPositionCount}</span>
        </span>
        <div className="h-4 w-px bg-white/10" />
        <span className="text-xs text-white/40">
          Regime: <span className="text-amber-400/80">{currentRegime.replace(/_/g, " ")}</span>
        </span>
        {crossAsset.vix_level != null && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs text-white/30">
              VIX: <span className={`font-medium ${crossAsset.vix_spike ? "text-red-400" : crossAsset.vix_level > 18 ? "text-orange-400" : "text-green-400"}`}>
                {crossAsset.vix_level.toFixed(1)}{crossAsset.vix_spike ? " SPIKE" : ""}
              </span>
            </span>
          </>
        )}
        {crossAsset.risk_regime && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              crossAsset.risk_regime === "RISK_ON" ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : crossAsset.risk_regime === "RISK_OFF" ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
            }`}>
              {crossAsset.risk_regime.replace(/_/g, " ")}
            </span>
          </>
        )}
        {liveData?.sharpe != null && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs text-white/30">
              Sharpe: <span className="text-amber-400/80">{liveData.sharpe.toFixed(2)}</span>
            </span>
          </>
        )}
        {liveData?.validation?.ready_for_live && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              Go Live
            </span>
          </>
        )}
        <div className="ml-auto">
          <span className={`text-sm font-medium ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}% return
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-white/5 pb-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              tab === t.key
                ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-400"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Portfolio Card */}
            <div className="crypto-card crypto-glow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-white/40 uppercase tracking-wider">Portfolio</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${currentMode === "live" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                  {currentMode}
                </span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{fmt(currentEquity)}</div>
              <div className={`text-sm font-medium ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {fmtSign(totalPnl)} ({totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%)
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30 uppercase">Cash</span>
                  <span className="text-sm text-white/80">{fmt(currentCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30 uppercase">Invested</span>
                  <span className="text-sm text-white/80">{fmt(invested)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30 uppercase">Unrealized</span>
                  <span className={`text-sm ${unrealizedPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>{fmtSign(unrealizedPnl)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30 uppercase">Realized</span>
                  <span className={`text-sm ${realizedPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>{fmtSign(realizedPnl)}</span>
                </div>
                <div className="pt-2">
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${totalPnl >= 0 ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(Math.max((currentEquity / initialCapital) * 100, 5), 150)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Regime Indicator */}
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Market Regime</h3>
              <div className="flex items-center justify-center h-24">
                <span className={`px-4 py-2 rounded-lg text-lg font-medium ${
                  currentRegime.includes("UP") ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : currentRegime.includes("DOWN") ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : currentRegime.includes("RANGING") ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : currentRegime.includes("VOLAT") ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-white/5 text-white/40 border border-white/10"
                }`}>
                  {currentRegime.replace(/_/g, " ")}
                </span>
              </div>
              {liveData?.tracked_symbols && (
                <div className="text-center text-xs text-white/30 mt-2">Tracking {liveData.tracked_symbols} symbols</div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Quick Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-sm text-white/60">Open Positions</span><span className="text-sm text-white font-medium">{openPositionCount}</span></div>
                <div className="flex justify-between"><span className="text-sm text-white/60">Closed Trades</span><span className="text-sm text-white font-medium">{liveData?.total_trades ?? closedTrades.length}</span></div>
                <div className="flex justify-between"><span className="text-sm text-white/60">Strategies</span><span className="text-sm text-white font-medium">{strategies.filter((s) => s.active).length}/{strategies.length}</span></div>
                <div className="flex justify-between"><span className="text-sm text-white/60">Win Rate</span><span className="text-sm text-amber-400 font-medium">{winRate > 0 ? `${(winRate * 100).toFixed(0)}%` : "--"}</span></div>
                <div className="flex justify-between"><span className="text-sm text-white/60">Total Return</span><span className={`text-sm font-medium ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>{totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%</span></div>
                {liveData?.sharpe != null && (
                  <div className="flex justify-between"><span className="text-sm text-white/60">Sharpe Ratio</span><span className="text-sm text-amber-400 font-medium">{liveData.sharpe.toFixed(2)}</span></div>
                )}
              </div>
            </div>
          </div>

          {/* Equity Chart */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-white/40 uppercase tracking-wider">Equity Curve</h3>
              {equityCurve && <span className="text-[10px] text-white/20">{equityCurve.length} data points</span>}
            </div>
            {equityCurve ? (
              <EquityChartSvg curve={equityCurve} initialCapital={initialCapital} />
            ) : (
              <div className="h-48 flex items-center justify-center text-white/20 text-sm">
                {currentEquity > 0 ? `Current equity: ${fmt(currentEquity)} — chart populates after trading begins` : "Engine starting up — equity curve will appear shortly"}
              </div>
            )}
          </div>

          {/* Price Grid */}
          {Object.keys(prices).length > 0 && (
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Prices ({Object.keys(prices).length})</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {Object.entries(prices).slice(0, 40).map(([symbol, price]: [string, any]) => (
                  <div key={symbol} className="bg-white/[0.02] rounded px-2 py-1.5 text-center">
                    <div className="text-[10px] text-white/40 truncate">{symbol}</div>
                    <div className="text-xs text-white font-medium">${typeof price === 'number' ? price.toLocaleString(undefined, {maximumFractionDigits: 2}) : price}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Position Table */}
          {positions.length > 0 && (
            <div className="crypto-card overflow-x-auto">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Open Positions ({positions.length})</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/30 text-xs uppercase">
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Side</th>
                    <th className="text-right py-2">Size</th>
                    <th className="text-right py-2">Entry</th>
                    <th className="text-right py-2">Current</th>
                    <th className="text-right py-2">P&L</th>
                    <th className="text-left py-2">Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p: any, i: number) => {
                    const pnl = p.unrealized_pnl || p.pnl || 0;
                    return (
                      <tr key={i} className="border-t border-white/5">
                        <td className="py-2 text-white font-medium">{p.symbol}</td>
                        <td className={`py-2 ${p.side === "long" ? "text-green-400" : "text-red-400"}`}>{(p.side || "long").toUpperCase()}</td>
                        <td className="py-2 text-right text-white/60">{p.size}</td>
                        <td className="py-2 text-right text-white/60">${p.entry_price?.toLocaleString() ?? "--"}</td>
                        <td className="py-2 text-right text-white/60">${p.current_price?.toLocaleString() ?? "--"}</td>
                        <td className={`py-2 text-right font-medium ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtSign(pnl)}</td>
                        <td className="py-2 text-white/40 text-xs">{p.strategy || "--"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* STRATEGIES TAB */}
      {tab === "strategies" && (
        <div>
          {strategies.length === 0 ? (
            <div className="crypto-card text-center py-12"><p className="text-white/20 text-sm">No strategies loaded. Engine may be offline.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategies.map((s) => (
                <div key={s.name} className={`crypto-card ${s.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white">{s.displayName}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.active ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}>
                      {s.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><div className="text-[10px] text-white/30 uppercase">Trades</div><div className="text-lg font-bold text-white">{s.trades}</div></div>
                    <div><div className="text-[10px] text-white/30 uppercase">Win Rate</div><div className="text-lg font-bold text-white">{s.winRate != null ? `${(s.winRate * 100).toFixed(0)}%` : "--"}</div></div>
                    <div><div className="text-[10px] text-white/30 uppercase">P&L</div><div className={`text-lg font-bold ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtSign(s.pnl)}</div></div>
                  </div>
                  {s.sharpe != null && (
                    <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs">
                      <span className="text-white/30">Sharpe Ratio</span>
                      <span className="text-amber-400">{s.sharpe.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Self-Improving Panel (below strategies) */}
      {tab === "strategies" && (Object.keys(strategyScores).length > 0 || recentLessons.length > 0) && (
        <div className="mt-6 space-y-4">
          {/* Adaptive Scoring */}
          {Object.keys(strategyScores).length > 0 && (
            <div className="crypto-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-white/40 uppercase tracking-wider">Self-Improving: Adaptive Scoring</h3>
                <span className="text-[10px] text-white/20">{tradeLessonCount} lessons learned</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-[10px] uppercase">
                      <th className="text-left py-2">Strategy</th>
                      <th className="text-right py-2">Win Rate</th>
                      <th className="text-right py-2">Kelly %</th>
                      <th className="text-right py-2">Expectancy</th>
                      <th className="text-right py-2">Profit Factor</th>
                      <th className="text-right py-2">Consec. Losses</th>
                      <th className="text-center py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(strategyScores).map(([name, score]: [string, any]) => {
                      const disabled = name in disabledStrategies;
                      return (
                        <tr key={name} className={`border-t border-white/5 ${disabled ? "opacity-40" : ""}`}>
                          <td className="py-2 text-white font-medium">{name.replace(/_/g, " ")}</td>
                          <td className={`py-2 text-right ${score.win_rate >= 0.5 ? "text-green-400" : score.win_rate >= 0.3 ? "text-orange-400" : "text-red-400"}`}>
                            {(score.win_rate * 100).toFixed(0)}%
                          </td>
                          <td className="py-2 text-right text-amber-400">{(score.kelly_fraction * 100).toFixed(1)}%</td>
                          <td className={`py-2 text-right ${score.expectancy >= 0 ? "text-green-400" : "text-red-400"}`}>
                            ${score.expectancy.toFixed(2)}
                          </td>
                          <td className={`py-2 text-right ${score.profit_factor >= 1 ? "text-green-400" : "text-red-400"}`}>
                            {score.profit_factor.toFixed(2)}
                          </td>
                          <td className={`py-2 text-right ${score.consecutive_losses >= 5 ? "text-red-400" : "text-white/60"}`}>
                            {score.consecutive_losses}
                          </td>
                          <td className="py-2 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${disabled ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                              {disabled ? "AUTO-OFF" : "Active"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-white/20 mt-3">
                Kelly % = adaptive position sizing from rolling win rate. Strategies auto-disable at &lt;25% win rate, 8 consecutive losses, or &lt;0.5 profit factor. Re-enables at 40% recovery win rate.
              </div>
            </div>
          )}

          {/* Recent AI Lessons */}
          {recentLessons.length > 0 && (
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">AI Trade Lessons</h3>
              <div className="space-y-2">
                {recentLessons.map((l: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2 bg-white/[0.02] rounded-lg p-3 border ${l.outcome === "win" ? "border-green-500/10" : "border-red-500/10"}`}>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold mt-0.5 ${l.outcome === "win" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {l.outcome.toUpperCase()}
                    </span>
                    <div>
                      <span className="text-xs text-amber-400/80">{l.strategy}</span>
                      <p className="text-xs text-white/60">{l.lesson}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRADES TAB */}
      {tab === "trades" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="crypto-card text-center">
              <div className="text-[10px] text-white/30 uppercase">Total P&L</div>
              <div className={`text-xl font-bold ${closedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtSign(closedPnl)}</div>
            </div>
            <div className="crypto-card text-center">
              <div className="text-[10px] text-white/30 uppercase">Win Rate</div>
              <div className="text-xl font-bold text-amber-400">{closedTrades.length > 0 ? `${(winRate * 100).toFixed(0)}%` : "--"}</div>
            </div>
            <div className="crypto-card text-center">
              <div className="text-[10px] text-white/30 uppercase">Total Trades</div>
              <div className="text-xl font-bold text-white">{closedTrades.length}</div>
            </div>
          </div>
          <div className="crypto-card overflow-x-auto">
            <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Trade History</h3>
            {closedTrades.length === 0 ? (
              <p className="text-sm text-white/20 text-center py-6">No completed trades yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/30 text-xs uppercase">
                    <th className="text-left py-2">Symbol</th><th className="text-left py-2">Side</th>
                    <th className="text-right py-2">Entry</th><th className="text-right py-2">Exit</th>
                    <th className="text-right py-2">P&L</th><th className="text-left py-2">Strategy</th>
                    <th className="text-left py-2">Reason</th><th className="text-left py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((t) => (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="py-2 text-white font-medium">{t.symbol}</td>
                      <td className={`py-2 ${t.side === "long" ? "text-green-400" : "text-red-400"}`}>{t.side.toUpperCase()}</td>
                      <td className="py-2 text-right text-white/60">${t.entryPrice.toLocaleString()}</td>
                      <td className="py-2 text-right text-white/60">${t.exitPrice?.toLocaleString() ?? "--"}</td>
                      <td className={`py-2 text-right font-medium ${(t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {(t.pnl || 0) >= 0 ? "+" : ""}${(t.pnl || 0).toFixed(2)}
                      </td>
                      <td className="py-2 text-white/40 text-xs">{t.strategy}</td>
                      <td className="py-2 text-white/30 text-xs">{t.exitReason || "--"}</td>
                      <td className="py-2 text-white/30 text-xs">{t.exitedAt ? new Date(t.exitedAt).toLocaleDateString() : "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PREDICTIONS TAB */}
      {tab === "predictions" && (
        <div className="space-y-4">
          <div className="crypto-card">
            <h3 className="text-xs text-white/40 uppercase tracking-wider mb-4">AI Predictions</h3>
            {Object.keys(livePredictions).length === 0 ? (
              <p className="text-sm text-white/20 text-center py-8">
                {engineOnline ? "Predictions will appear after the first AI prediction cycle (runs every 4 hours)" : "Engine offline — no predictions available"}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(livePredictions).map(([symbol, pred]: [string, any]) => (
                  <div key={symbol} className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{symbol}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        pred?.direction === "up" ? "bg-green-500/20 text-green-400"
                        : pred?.direction === "down" ? "bg-red-500/20 text-red-400"
                        : "bg-white/5 text-white/30"
                      }`}>
                        {pred?.direction?.toUpperCase() || "NEUTRAL"}
                      </span>
                    </div>
                    {pred?.confidence != null && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-white/5 rounded-full">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(pred.confidence * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-amber-400">{(pred.confidence * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {pred?.target_price && (
                      <div className="text-xs text-white/30 mt-1">Target: ${pred.target_price.toLocaleString()}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DATA FEEDS TAB */}
      {tab === "datafeeds" && (
        <div className="space-y-4">
          {/* Cross-Asset Signals */}
          <div className="crypto-card crypto-glow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs text-white/40 uppercase tracking-wider">Cross-Asset Correlation Signals</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${crossAsset.fresh ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}>
                {crossAsset.fresh ? "Live" : "Stale"}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">VIX Level</div>
                <div className={`text-xl font-bold ${(crossAsset.vix_level ?? 0) > 25 ? "text-red-400" : (crossAsset.vix_level ?? 0) > 18 ? "text-orange-400" : "text-green-400"}`}>
                  {crossAsset.vix_level?.toFixed(1) ?? "--"}
                </div>
                {crossAsset.vix_spike && (
                  <div className="text-[10px] px-1.5 py-0.5 mt-1 rounded bg-red-500/20 text-red-400 inline-block">SPIKE</div>
                )}
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Risk Regime</div>
                <div className={`text-lg font-bold ${
                  crossAsset.risk_regime === "RISK_ON" ? "text-green-400"
                  : crossAsset.risk_regime === "RISK_OFF" ? "text-red-400"
                  : crossAsset.risk_regime === "CAUTIOUS" ? "text-orange-400"
                  : "text-white/60"
                }`}>
                  {crossAsset.risk_regime?.replace(/_/g, " ") ?? "--"}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Bond-Equity Divergence</div>
                <div className={`text-lg font-bold ${crossAsset.bond_equity_divergence ? "text-red-400" : "text-green-400"}`}>
                  {crossAsset.bond_equity_divergence ? "DETECTED" : "Normal"}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Credit Stress</div>
                <div className={`text-lg font-bold ${crossAsset.credit_stress ? "text-red-400" : "text-green-400"}`}>
                  {crossAsset.credit_stress ? "STRESSED" : "Normal"}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-white/20">Updates every 5 min. Tracks ^VIX, TLT, DX-Y.NYB, HYG, ^TNX, SPY</div>
          </div>

          {/* FRED Macro */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs text-white/40 uppercase tracking-wider">FRED Macro Economics</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${macro.fresh ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}>
                {macro.fresh ? "Live" : "Stale"}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Economic Phase</div>
                <div className={`text-lg font-bold capitalize ${
                  macro.economic_phase === "expansion" ? "text-green-400"
                  : macro.economic_phase === "recovery" ? "text-blue-400"
                  : macro.economic_phase === "slowdown" ? "text-orange-400"
                  : macro.economic_phase === "contraction" ? "text-red-400"
                  : "text-white/60"
                }`}>
                  {macro.economic_phase ?? "--"}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Yield Curve</div>
                <div className={`text-lg font-bold ${macro.yield_curve_inverted ? "text-red-400" : "text-green-400"}`}>
                  {macro.yield_curve_inverted ? "INVERTED" : "Normal"}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Unemployment</div>
                <div className="text-lg font-bold text-white">{macro.unemployment_rate ?? "--"}%</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Fed Funds Rate</div>
                <div className="text-lg font-bold text-amber-400">{macro.fed_funds_rate ?? "--"}%</div>
              </div>
            </div>
            <div className="text-[10px] text-white/20">Updates every 6h. Source: Federal Reserve Economic Data (FRED API)</div>
          </div>

          {/* News Sentiment */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs text-white/40 uppercase tracking-wider">AI News Sentiment</h3>
              <span className="text-[10px] text-white/20">{liveData?.sentiment?.headline_count ?? 0} headlines</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all ${sentimentScore > 0 ? "bg-green-500" : sentimentScore < 0 ? "bg-red-500" : "bg-white/20"}`}
                    style={{ width: `${Math.abs(sentimentScore) * 50 + 50}%`, marginLeft: sentimentScore < 0 ? `${50 - Math.abs(sentimentScore) * 50}%` : "50%" }}
                  />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                </div>
                <div className="flex justify-between text-[10px] text-white/20 mt-1">
                  <span>Bearish</span>
                  <span>Neutral</span>
                  <span>Bullish</span>
                </div>
              </div>
              <div className={`text-2xl font-bold ${sentimentScore > 0.2 ? "text-green-400" : sentimentScore < -0.2 ? "text-red-400" : "text-white/60"}`}>
                {sentimentScore > 0 ? "+" : ""}{sentimentScore.toFixed(2)}
              </div>
            </div>
            <div className="text-[10px] text-white/20">Qwen3.5-35B AI scores 7 RSS feeds: Yahoo Finance, MarketWatch, CNBC, Reuters, Seeking Alpha, Benzinga, Investing.com</div>
          </div>

          {/* Options Flow */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs text-white/40 uppercase tracking-wider">Unusual Options Activity</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${optionsFlow.fresh ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}>
                {optionsFlow.fresh ? "Live" : "Stale"}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Market Bias</div>
                <div className={`text-lg font-bold capitalize ${
                  optionsFlow.market_bias === "bullish" ? "text-green-400"
                  : optionsFlow.market_bias === "bearish" ? "text-red-400"
                  : "text-white/60"
                }`}>
                  {optionsFlow.market_bias ?? "--"}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Bullish Unusual</div>
                <div className="text-lg font-bold text-green-400">{optionsFlow.bullish_unusual ?? 0}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Bearish Unusual</div>
                <div className="text-lg font-bold text-red-400">{optionsFlow.bearish_unusual ?? 0}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase mb-1">Symbols Scanned</div>
                <div className="text-lg font-bold text-white">{optionsFlow.symbols_scanned ?? 0}</div>
              </div>
            </div>
            <div className="text-[10px] text-white/20">Updates every 15 min. Scans nearest 4 expirations via yfinance, detects vol/OI &gt; 3x</div>
          </div>

          {/* Insider Trading */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs text-white/40 uppercase tracking-wider">SEC Insider Trading</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${insiderData.fresh ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}>
                {insiderData.fresh ? "Live" : "Stale"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5 text-center">
                <div className="text-[10px] text-white/30 uppercase mb-1">Cluster Buys</div>
                <div className={`text-2xl font-bold ${(insiderData.cluster_buys ?? 0) > 0 ? "text-green-400" : "text-white/30"}`}>
                  {insiderData.cluster_buys ?? 0}
                </div>
                <div className="text-[10px] text-white/20 mt-1">3+ insiders buying within 30d</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5 text-center">
                <div className="text-[10px] text-white/30 uppercase mb-1">Total Scanned</div>
                <div className="text-2xl font-bold text-white">{insiderData.total_scanned ?? 0}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5 text-center">
                <div className="text-[10px] text-white/30 uppercase mb-1">Signal</div>
                <div className="text-lg font-bold text-amber-400">
                  {(insiderData.cluster_buys ?? 0) > 0 ? "ACTIVE" : "Monitoring"}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-white/20">Updates every 60 min. Scans SEC Form 4 filings for open market purchases (not option exercises)</div>
          </div>

          {/* Earnings Data */}
          {earningsData?.symbols_with_data > 0 && (
            <div className="crypto-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-white/40 uppercase tracking-wider">Earnings Data (PEAD)</h3>
                <span className="text-[10px] text-white/20">{earningsData.symbols_with_data} symbols tracked</span>
              </div>
              <div className="text-sm text-white/40 mb-2">
                Post-Earnings Announcement Drift strategy monitors earnings surprises across all tracked symbols.
                Stocks with &gt;5% EPS surprise tend to drift for ~15 trading days.
              </div>
              <div className="text-[10px] text-white/20">Updates daily via yfinance earnings_history. Last update: {earningsData.last_update ? new Date(earningsData.last_update).toLocaleString() : "pending"}</div>
            </div>
          )}

          {/* Data Source Health Grid */}
          <div className="crypto-card">
            <h3 className="text-xs text-white/40 uppercase tracking-wider mb-4">Data Source Health</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(dataSources).map(([name, info]: [string, any]) => (
                <div key={name} className="flex items-center gap-2 bg-white/[0.02] rounded px-3 py-2 border border-white/5">
                  <span className={`w-2 h-2 rounded-full ${info?.fresh ? "bg-green-400" : info?.enabled ? "bg-amber-400" : "bg-red-400/50"}`} />
                  <span className="text-xs text-white/60">{name.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-white/20 ml-auto">{info?.fresh ? "OK" : info?.enabled ? "Stale" : "Off"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MARKET INTEL TAB */}
      {tab === "market" && (
        <div className="space-y-4">
          {/* TradingView Signals */}
          <div className="crypto-card">
            <h3 className="text-xs text-white/40 uppercase tracking-wider mb-4">TradingView Technical Analysis</h3>
            {Object.keys(tvSignals).length === 0 ? (
              <p className="text-sm text-white/20 text-center py-8">
                {engineOnline ? "TradingView signals update every 5 minutes" : "Engine offline"}
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(tvSignals).map(([symbol, signal]: [string, any]) => (
                  <div key={symbol} className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-white/40 mb-1">{symbol}</div>
                    <div className={`text-sm font-bold ${
                      signal?.recommendation?.includes("BUY") ? "text-green-400"
                      : signal?.recommendation?.includes("SELL") ? "text-red-400"
                      : "text-white/60"
                    }`}>
                      {signal?.recommendation || "N/A"}
                    </div>
                    <div className="flex gap-2 mt-1 text-[10px]">
                      <span className="text-green-400/60">B:{signal?.buy || 0}</span>
                      <span className="text-white/30">N:{signal?.neutral || 0}</span>
                      <span className="text-red-400/60">S:{signal?.sell || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prices Table */}
          {Object.keys(prices).length > 0 && (
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Live Prices</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {Object.entries(prices).map(([symbol, price]: [string, any]) => (
                  <div key={symbol} className="bg-white/[0.02] rounded px-3 py-2">
                    <div className="text-[10px] text-white/40">{symbol}</div>
                    <div className="text-sm text-white font-medium">${typeof price === 'number' ? price.toLocaleString(undefined, {maximumFractionDigits: 2}) : price}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPTIMIZER TAB */}
      {tab === "optimizer" && (
        <div className="space-y-4">
          <div className="crypto-card">
            <h3 className="text-xs text-white/40 uppercase tracking-wider mb-4">AI Strategy Optimizer</h3>
            <p className="text-sm text-white/40 mb-4">
              The AI optimizer runs every 30 minutes, analyzing strategy performance and adjusting parameters
              to maximize risk-adjusted returns. Changes are logged below.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                <div className="text-[10px] text-white/30 uppercase">Regime</div>
                <div className="text-sm font-medium text-amber-400">{currentRegime.replace(/_/g, " ")}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                <div className="text-[10px] text-white/30 uppercase">Sharpe</div>
                <div className="text-sm font-medium text-white">{liveData?.sharpe?.toFixed(2) ?? "--"}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                <div className="text-[10px] text-white/30 uppercase">Active Strategies</div>
                <div className="text-sm font-medium text-white">{strategies.filter(s => s.active).length}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                <div className="text-[10px] text-white/30 uppercase">Total Trades</div>
                <div className="text-sm font-medium text-white">{liveData?.total_trades ?? closedTrades.length}</div>
              </div>
            </div>
            {liveData?.validation && (
              <div className="bg-white/[0.02] rounded-lg p-4 border border-white/5">
                <h4 className="text-xs text-white/40 uppercase mb-3">Live Trading Validation</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Days Required</span>
                    <span className={`font-medium ${liveData.validation.days_elapsed >= liveData.validation.days_required ? "text-green-400" : "text-white/40"}`}>
                      {liveData.validation.days_elapsed?.toFixed(0) ?? 0} / {liveData.validation.days_required}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Min Sharpe</span>
                    <span className={`font-medium ${liveData.validation.sharpe_pass ? "text-green-400" : "text-white/40"}`}>
                      {liveData.validation.sharpe?.toFixed(2) ?? "--"} / {liveData.validation.sharpe_required}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Min Trades</span>
                    <span className={`font-medium ${liveData.validation.trade_count >= liveData.validation.trades_required ? "text-green-400" : "text-white/40"}`}>
                      {liveData.validation.trade_count} / {liveData.validation.trades_required}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Max Drawdown</span>
                    <span className={`font-medium ${liveData.validation.drawdown_pct <= liveData.validation.max_drawdown_pct ? "text-green-400" : "text-red-400"}`}>
                      {liveData.validation.drawdown_pct?.toFixed(1) ?? 0}% / {liveData.validation.max_drawdown_pct}%
                    </span>
                  </div>
                  {liveData.validation.blockers?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="text-[10px] text-white/30 uppercase mb-1">Blockers</div>
                      {liveData.validation.blockers.map((b: string, i: number) => (
                        <div key={i} className="text-xs text-red-400/60">{b}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WORKFLOW TAB */}
      {tab === "workflow" && (
        <div className="crypto-card">
          <h3 className="text-xs text-white/40 uppercase tracking-wider mb-4">Engine Cycle Workflow</h3>
          <p className="text-sm text-white/30 mb-6">
            Each engine cycle runs every {assetClass.includes("polymarket") ? "60" : "30"} seconds during market hours.
          </p>
          <div className="space-y-3">
            {[
              { step: 1, name: "Update Prices", desc: "Fetch latest prices + OHLCV for all tracked symbols", icon: "\ud83d\udcca" },
              { step: 2, name: "Check Regime", desc: "AI detects market regime (trending, ranging, volatile)", icon: "\ud83d\udd0d" },
              { step: 3, name: "Run Predictions", desc: "AI prediction engine generates directional forecasts", icon: "\ud83e\udd16" },
              { step: 4, name: "Supplementary Data", desc: "TradingView signals, sector data, market movers", icon: "\ud83d\udce1" },
              { step: 5, name: "Risk Check", desc: "Verify portfolio risk limits (drawdown, daily loss)", icon: "\ud83d\udee1\ufe0f" },
              { step: 6, name: "Run Strategies", desc: "Execute all active strategies on all symbols", icon: "\u26a1" },
              { step: 7, name: "Stop Loss / Take Profit", desc: "Check and close positions hitting SL/TP levels", icon: "\ud83c\udfaf" },
              { step: 8, name: "AI Optimizer", desc: "Tune strategy parameters based on performance", icon: "\ud83e\udde0" },
              { step: 9, name: "Daily Summary", desc: "Send Telegram notification with daily P&L", icon: "\ud83d\udce8" },
              { step: 10, name: "Update Equity", desc: "Record equity curve data point", icon: "\ud83d\udcc8" },
              { step: 11, name: "Sync Balance", desc: "Reconcile with exchange (live mode only)", icon: "\ud83d\udd04" },
              { step: 12, name: "Persist State", desc: "Save snapshot to database", icon: "\ud83d\udcbe" },
            ].map((step) => (
              <div key={step.step} className="flex items-start gap-3 bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                  {step.step}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{step.icon} {step.name}</div>
                  <div className="text-xs text-white/40">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Inline Equity Chart SVG ─── */
function EquityChartSvg({ curve, initialCapital }: { curve: [string, number][]; initialCapital: number }) {
  const values = curve.map((d) => d[1]);
  const allValues = [...values, initialCapital];
  const min = Math.min(...allValues) * 0.998;
  const max = Math.max(...allValues) * 1.002;
  const range = max - min || 1;
  const w = 800;
  const h = 200;
  const pad = 4;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  const capY = pad + (h - pad * 2) - ((initialCapital - min) / range) * (h - pad * 2);
  const currentEquity = values[values.length - 1];
  const isProfit = currentEquity >= initialCapital;
  const gradientColor = isProfit ? "#22c55e" : "#ef4444";
  const first = new Date(curve[0][0]);
  const last = new Date(curve[curve.length - 1][0]);

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`eqGrad-${initialCapital}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={gradientColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((pct) => (
          <line key={pct} x1={pad} y1={pad + (h - pad * 2) * pct} x2={w - pad} y2={pad + (h - pad * 2) * pct} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        ))}
        <line x1={pad} y1={capY} x2={w - pad} y2={capY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 4" opacity="0.3" />
        <text x={w - pad - 2} y={capY - 4} textAnchor="end" fill="#f59e0b" opacity="0.4" fontSize="9">${initialCapital.toLocaleString()}</text>
        <path d={areaPath} fill={`url(#eqGrad-${initialCapital})`} />
        <path d={linePath} stroke={gradientColor} strokeWidth="2" fill="none" />
        <circle cx={parseFloat(points[points.length - 1].split(",")[0])} cy={parseFloat(points[points.length - 1].split(",")[1])} r="3" fill={gradientColor} />
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>{first.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span className={`font-medium ${isProfit ? "text-green-400/60" : "text-red-400/60"}`}>${currentEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        <span>{last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </>
  );
}
