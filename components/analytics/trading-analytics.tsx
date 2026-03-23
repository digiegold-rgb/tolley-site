"use client";

import { useState, useEffect, useCallback } from "react";

interface EngineData {
  online: boolean;
  mode?: string;
  regime?: string;
  equity?: number;
  cash?: number;
  realized_pnl?: number;
  unrealized_pnl?: number;
  combined_pnl?: number;
  open_positions?: number;
  total_trades?: number;
  sharpe?: number;
  uptime_hours?: string;
  validation?: {
    days_elapsed?: number;
    days_required?: number;
    sharpe?: number;
    sharpe_pass?: boolean;
    drawdown_pct?: number;
    ready_for_live?: boolean;
    blockers?: string[];
  };
  strategies?: Record<string, { active?: boolean; trades?: number; win_rate?: number; sharpe?: number }>;
  equity_curve?: { start?: number; end?: number; peak?: number; trough?: number; return_pct?: number };
  positions?: { symbol: string; quantity: number; entry_price: number; current_price: number; unrealized_pnl: number; strategy: string }[];
}

interface Snapshot {
  timestamp: string;
  engines: Record<string, EngineData>;
  summary: {
    engines_online: number;
    total_equity: number;
    total_realized_pnl: number;
    total_unrealized_pnl: number;
    combined_pnl: number;
    total_trades: number;
    overall_return_pct: number;
  };
}

const ENGINE_LABELS: Record<string, string> = {
  crypto: "Crypto",
  stocks_conservative: "Stocks Conservative",
  stocks_aggressive: "Stocks Aggressive",
  polymarket: "Polymarket",
};

const ENGINE_ICONS: Record<string, string> = {
  crypto: "\u20BF",
  stocks_conservative: "\u2191",
  stocks_aggressive: "\u26A1",
  polymarket: "\u2696",
};

const fmt = (n: number) => "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSign = (n: number) => (n >= 0 ? "+" : "-") + fmt(n);

export default function TradingAnalytics() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/analytics?mode=snapshot");
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="text-white/20 text-sm">Loading trading analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="text-red-400 text-sm">Trading analytics unavailable: {error}</div>
      </div>
    );
  }

  const { summary, engines } = data;
  const pnlColor = summary.combined_pnl >= 0 ? "text-green-400" : "text-red-400";
  const returnColor = summary.overall_return_pct >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-bold">
            $
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Trading Platform</h3>
            <span className="text-[10px] text-white/30">
              {summary.engines_online}/4 engines &middot; {summary.total_trades} trades &middot; updated {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        <a href="/trading" className="text-[10px] text-amber-400/60 hover:text-amber-400 transition">
          Full Dashboard &rarr;
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Total Equity</div>
          <div className="text-lg font-bold text-white mt-1">{fmt(summary.total_equity)}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Combined P&L</div>
          <div className={`text-lg font-bold mt-1 ${pnlColor}`}>{fmtSign(summary.combined_pnl)}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Return</div>
          <div className={`text-lg font-bold mt-1 ${returnColor}`}>{summary.overall_return_pct >= 0 ? "+" : ""}{summary.overall_return_pct.toFixed(2)}%</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Total Trades</div>
          <div className="text-lg font-bold text-white mt-1">{summary.total_trades}</div>
        </div>
      </div>

      {/* Engine cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(engines).map(([name, engine]) => {
          if (!engine.online) {
            return (
              <div key={name} className="rounded-xl border border-white/5 bg-white/[0.01] p-4 opacity-50">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ENGINE_ICONS[name]}</span>
                  <span className="text-sm text-white/40">{ENGINE_LABELS[name]}</span>
                  <span className="ml-auto text-[10px] text-red-400/60">Offline</span>
                </div>
              </div>
            );
          }

          const isExpanded = expanded === name;
          const enginePnl = (engine.realized_pnl ?? 0) + (engine.unrealized_pnl ?? 0);
          const enginePnlColor = enginePnl >= 0 ? "text-green-400" : "text-red-400";
          const eqReturn = engine.equity_curve?.return_pct ?? 0;

          return (
            <div
              key={name}
              className="rounded-xl border border-white/8 bg-white/[0.02] p-4 cursor-pointer hover:border-amber-500/20 transition"
              onClick={() => setExpanded(isExpanded ? null : name)}
            >
              {/* Engine header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ENGINE_ICONS[name]}</span>
                  <div>
                    <span className="text-sm font-medium text-white">{ENGINE_LABELS[name]}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-[10px] text-white/30">{engine.regime} &middot; {engine.mode}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">{fmt(engine.equity ?? 0)}</div>
                  <div className={`text-[11px] font-medium ${enginePnlColor}`}>{fmtSign(enginePnl)}</div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-[9px] text-white/25 uppercase">Positions</div>
                  <div className="text-xs font-medium text-white">{engine.open_positions}</div>
                </div>
                <div>
                  <div className="text-[9px] text-white/25 uppercase">Trades</div>
                  <div className="text-xs font-medium text-white">{engine.total_trades}</div>
                </div>
                <div>
                  <div className="text-[9px] text-white/25 uppercase">Sharpe</div>
                  <div className={`text-xs font-medium ${(engine.sharpe ?? 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                    {(engine.sharpe ?? 0).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-white/25 uppercase">Return</div>
                  <div className={`text-xs font-medium ${eqReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {eqReturn >= 0 ? "+" : ""}{eqReturn.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Validation bar */}
              {engine.validation && engine.validation.days_required && (
                <div className="mt-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-white/25 uppercase">Validation</span>
                    <span className="text-[9px] text-white/30">
                      {(engine.validation.days_elapsed ?? 0).toFixed(1)} / {engine.validation.days_required} days
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${engine.validation.ready_for_live ? "bg-green-400" : "bg-amber-400/60"}`}
                      style={{ width: `${Math.min(100, ((engine.validation.days_elapsed ?? 0) / (engine.validation.days_required || 30)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Expanded: strategies + positions */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                  {/* Strategies */}
                  {engine.strategies && Object.keys(engine.strategies).length > 0 && (
                    <div>
                      <div className="text-[9px] text-white/25 uppercase mb-1.5">Strategies</div>
                      <div className="space-y-1">
                        {Object.entries(engine.strategies).map(([sName, s]) => (
                          <div key={sName} className="flex items-center justify-between text-[11px]">
                            <span className={s.active ? "text-white/60" : "text-white/20"}>
                              {s.active ? "\u2713" : "\u2715"} {sName}
                            </span>
                            <span className="text-white/30">
                              {s.trades ?? 0} trades
                              {(s.win_rate ?? 0) > 0 ? ` \u00B7 ${((s.win_rate ?? 0) * 100).toFixed(0)}% win` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top positions */}
                  {engine.positions && engine.positions.length > 0 && (
                    <div>
                      <div className="text-[9px] text-white/25 uppercase mb-1.5">Positions ({engine.positions.length})</div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {engine.positions.slice(0, 10).map((p, i) => {
                          const pct = p.entry_price > 0 ? ((p.current_price / p.entry_price) - 1) * 100 : 0;
                          return (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                              <span className="text-white/50 font-mono">{p.symbol.replace("_USDT", "")}</span>
                              <span className={pct >= 0 ? "text-green-400/70" : "text-red-400/70"}>
                                {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Blockers */}
                  {engine.validation?.blockers && engine.validation.blockers.length > 0 && (
                    <div>
                      <div className="text-[9px] text-white/25 uppercase mb-1">Blockers</div>
                      {engine.validation.blockers.map((b, i) => (
                        <div key={i} className="text-[10px] text-amber-400/60">{b}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
