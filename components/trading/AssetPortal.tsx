"use client";

import { useState, useEffect } from "react";

type Tab = "overview" | "strategies" | "trades";

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

  // Poll live engine data every 15s
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/trading/${assetClass}/live`);
        if (res.ok) {
          const data = await res.json();
          setLiveData(data);
          setEngineOnline(true);

          // Update strategies from live data
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

  const fmt = (n: number) =>
    "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSign = (n: number) =>
    (n >= 0 ? "+" : "") + fmt(Math.abs(n));

  // Equity chart from live data
  const equityCurve: [string, number][] | null =
    liveData?.equity_curve && liveData.equity_curve.length > 2
      ? liveData.equity_curve
      : null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "strategies", label: "Strategies", count: strategies.length },
    { key: "trades", label: "Trades", count: trades.length },
  ];

  // Closed trades for trade history stats
  const closedTrades = trades.filter((t) => t.status === "closed");
  const closedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = closedTrades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = closedTrades.length > 0 ? wins / closedTrades.length : 0;

  return (
    <div>
      {/* Status bar */}
      <div className="crypto-card mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              engineOnline ? "bg-green-400 pulse-gold" : "bg-red-400/50"
            }`}
          />
          <span className="text-sm text-white/60">
            {engineOnline ? "Engine Online" : "Engine Offline"}
          </span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
            currentMode === "live"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}
        >
          {currentMode}
        </span>
        <div className="h-4 w-px bg-white/10" />
        <span className="text-xs text-white/40">
          Regime:{" "}
          <span className="text-amber-400/80">{currentRegime.replace(/_/g, " ")}</span>
        </span>
        {liveData?.uptime_seconds && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs text-white/30">
              Uptime: {Math.floor(liveData.uptime_seconds / 3600)}h{" "}
              {Math.floor((liveData.uptime_seconds % 3600) / 60)}m
            </span>
          </>
        )}
        <div className="ml-auto">
          <span
            className={`text-sm font-medium ${
              totalReturn >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {totalReturn >= 0 ? "+" : ""}
            {totalReturn.toFixed(2)}% return
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-white/5 pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
              tab === t.key
                ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-400"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Row 1: Portfolio + Regime + Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Portfolio Card */}
            <div className="crypto-card crypto-glow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-white/40 uppercase tracking-wider">Portfolio</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                    currentMode === "live"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
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
                  <span className={`text-sm ${unrealizedPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>
                    {fmtSign(unrealizedPnl)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-white/30 uppercase">Realized</span>
                  <span className={`text-sm ${realizedPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>
                    {fmtSign(realizedPnl)}
                  </span>
                </div>
                <div className="pt-2">
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${totalPnl >= 0 ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(Math.max((currentEquity / initialCapital) * 100, 5), 150)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-white/15">$0</span>
                    <span className="text-[9px] text-white/15">${initialCapital.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Regime Indicator */}
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Market Regime</h3>
              <div className="flex items-center justify-center h-24">
                <span
                  className={`regime-badge text-lg ${
                    currentRegime.includes("UP")
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : currentRegime.includes("DOWN")
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : currentRegime.includes("RANGING")
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-white/5 text-white/40 border border-white/10"
                  }`}
                >
                  {currentRegime.replace(/_/g, " ")}
                </span>
              </div>
              {liveData?.tracked_symbols && (
                <div className="text-center text-xs text-white/30 mt-2">
                  Tracking {liveData.tracked_symbols} symbols
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Quick Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Open Positions</span>
                  <span className="text-sm text-white font-medium">{openPositionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Closed Trades</span>
                  <span className="text-sm text-white font-medium">
                    {liveData?.total_trades ?? closedTrades.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Strategies</span>
                  <span className="text-sm text-white font-medium">
                    {strategies.filter((s) => s.active).length}/{strategies.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Win Rate</span>
                  <span className="text-sm text-amber-400 font-medium">
                    {winRate > 0 ? `${(winRate * 100).toFixed(0)}%` : "--"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Total Return</span>
                  <span className={`text-sm font-medium ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Equity Chart */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-white/40 uppercase tracking-wider">Equity Curve</h3>
              {equityCurve && (
                <span className="text-[10px] text-white/20">{equityCurve.length} data points</span>
              )}
            </div>
            {equityCurve ? (
              <EquityChartSvg
                curve={equityCurve}
                initialCapital={initialCapital}
              />
            ) : (
              <div className="h-48 flex items-center justify-center text-white/20 text-sm">
                {currentEquity > 0
                  ? `Current equity: ${fmt(currentEquity)} — chart populates after a few minutes of trading`
                  : "Engine starting up — equity curve will appear shortly"}
              </div>
            )}
          </div>

          {/* Row 3: Position Table */}
          {positions.length > 0 && (
            <div className="crypto-card overflow-x-auto">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                Open Positions ({positions.length})
              </h3>
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
                        <td className={`py-2 ${p.side === "long" ? "text-green-400" : "text-red-400"}`}>
                          {(p.side || "long").toUpperCase()}
                        </td>
                        <td className="py-2 text-right text-white/60">{p.size}</td>
                        <td className="py-2 text-right text-white/60">
                          ${p.entry_price?.toLocaleString() ?? "--"}
                        </td>
                        <td className="py-2 text-right text-white/60">
                          ${p.current_price?.toLocaleString() ?? "--"}
                        </td>
                        <td className={`py-2 text-right font-medium ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {fmtSign(pnl)}
                        </td>
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
            <div className="crypto-card text-center py-12">
              <p className="text-white/20 text-sm">No strategies loaded. Engine may be offline.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategies.map((s) => (
                <div key={s.name} className={`crypto-card ${s.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white">{s.displayName}</h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        s.active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-white/5 text-white/30"
                      }`}
                    >
                      {s.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[10px] text-white/30 uppercase">Trades</div>
                      <div className="text-lg font-bold text-white">{s.trades}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/30 uppercase">Win Rate</div>
                      <div className="text-lg font-bold text-white">
                        {s.winRate != null ? `${(s.winRate * 100).toFixed(0)}%` : "--"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/30 uppercase">P&L</div>
                      <div
                        className={`text-lg font-bold ${
                          s.pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fmtSign(s.pnl)}
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
              ))}
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
              <div className={`text-xl font-bold ${closedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {fmtSign(closedPnl)}
              </div>
            </div>
            <div className="crypto-card text-center">
              <div className="text-[10px] text-white/30 uppercase">Win Rate</div>
              <div className="text-xl font-bold text-amber-400">
                {closedTrades.length > 0 ? `${(winRate * 100).toFixed(0)}%` : "--"}
              </div>
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
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Side</th>
                    <th className="text-right py-2">Entry</th>
                    <th className="text-right py-2">Exit</th>
                    <th className="text-right py-2">P&L</th>
                    <th className="text-left py-2">Strategy</th>
                    <th className="text-left py-2">Reason</th>
                    <th className="text-left py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((t) => (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="py-2 text-white font-medium">{t.symbol}</td>
                      <td className={`py-2 ${t.side === "long" ? "text-green-400" : "text-red-400"}`}>
                        {t.side.toUpperCase()}
                      </td>
                      <td className="py-2 text-right text-white/60">${t.entryPrice.toLocaleString()}</td>
                      <td className="py-2 text-right text-white/60">
                        ${t.exitPrice?.toLocaleString() ?? "--"}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${
                          (t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {(t.pnl || 0) >= 0 ? "+" : ""}${(t.pnl || 0).toFixed(2)}
                      </td>
                      <td className="py-2 text-white/40 text-xs">{t.strategy}</td>
                      <td className="py-2 text-white/30 text-xs">{t.exitReason || "--"}</td>
                      <td className="py-2 text-white/30 text-xs">
                        {t.exitedAt ? new Date(t.exitedAt).toLocaleDateString() : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Inline Equity Chart SVG ─── */
function EquityChartSvg({
  curve,
  initialCapital,
}: {
  curve: [string, number][];
  initialCapital: number;
}) {
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
  const duration = (last.getTime() - first.getTime()) / 1000 / 60;

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
          <line
            key={pct}
            x1={pad} y1={pad + (h - pad * 2) * pct}
            x2={w - pad} y2={pad + (h - pad * 2) * pct}
            stroke="rgba(255,255,255,0.03)" strokeWidth="1"
          />
        ))}
        <line
          x1={pad} y1={capY} x2={w - pad} y2={capY}
          stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 4" opacity="0.3"
        />
        <text x={w - pad - 2} y={capY - 4} textAnchor="end" fill="#f59e0b" opacity="0.4" fontSize="9">
          ${initialCapital.toLocaleString()}
        </text>
        <path d={areaPath} fill={`url(#eqGrad-${initialCapital})`} />
        <path d={linePath} stroke={gradientColor} strokeWidth="2" fill="none" />
        <circle
          cx={parseFloat(points[points.length - 1].split(",")[0])}
          cy={parseFloat(points[points.length - 1].split(",")[1])}
          r="3" fill={gradientColor}
        />
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>{first.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span className={`font-medium ${isProfit ? "text-green-400/60" : "text-red-400/60"}`}>
          ${currentEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span>{last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </>
  );
}
