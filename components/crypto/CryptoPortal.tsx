"use client";

import { useState, useEffect } from "react";
import PortfolioCard from "./PortfolioCard";
import PositionTable from "./PositionTable";
import StrategyCards from "./StrategyCards";
import RegimeIndicator from "./RegimeIndicator";
import EquityChart from "./EquityChart";
import TradeHistory from "./TradeHistory";
import PredictionScorecard from "./PredictionScorecard";
import BotStatusBar from "./BotStatusBar";
import PriceGrid from "./PriceGrid";

type Tab = "overview" | "strategies" | "trades" | "predictions";

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

interface PredictionInfo {
  id: string;
  asset: string;
  direction: string;
  targetPrice: number;
  confidence: number;
  rationale: string | null;
  currentPrice: number;
  actualPrice: number | null;
  accuracy: number | null;
  status: string;
  targetDate: string;
  createdAt: string;
}

interface Props {
  initialSnapshot: Snapshot | null;
  initialStrategies: StrategyInfo[];
  initialTrades: TradeInfo[];
  initialPredictions: PredictionInfo[];
}

export default function CryptoPortal({
  initialSnapshot,
  initialStrategies,
  initialTrades,
  initialPredictions,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [strategies, setStrategies] = useState(initialStrategies);
  const [trades, setTrades] = useState(initialTrades);
  const [predictions, setPredictions] = useState(initialPredictions);
  const [liveData, setLiveData] = useState<any>(null);
  const [engineOnline, setEngineOnline] = useState(false);

  // Poll live engine data every 15s
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/crypto/live");
        if (res.ok) {
          const data = await res.json();
          setLiveData(data);
          setEngineOnline(true);
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
  }, []);

  const currentEquity = liveData?.equity ?? snapshot?.equity ?? 0;
  const currentCash = liveData?.cash ?? snapshot?.cash ?? 0;
  const currentRegime = liveData?.regime ?? snapshot?.regime ?? "UNKNOWN";
  const currentMode = liveData?.mode ?? snapshot?.engineMode ?? "paper";
  const initialCapital = 10000;
  const totalReturn = ((currentEquity - initialCapital) / initialCapital) * 100;
  const positions = liveData?.positions ?? [];
  const prices = liveData?.prices ?? snapshot?.metadata?.prices ?? {};
  const livePredictions = liveData?.predictions ?? [];

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "strategies", label: "Strategies", count: Object.keys(liveData?.strategies ?? {}).length || strategies.length },
    { key: "trades", label: "Trades", count: trades.length },
    { key: "predictions", label: "Predictions", count: predictions.length || livePredictions.length },
  ];

  return (
    <div>
      <BotStatusBar
        online={engineOnline}
        mode={currentMode}
        uptime={liveData?.uptime_seconds}
        trackedSymbols={liveData?.tracked_symbols ?? Object.keys(prices).length}
        openPositions={liveData?.open_positions ?? snapshot?.openPositions ?? 0}
        totalReturn={totalReturn}
      />

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
              <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {/* Row 1: Portfolio + Regime + Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PortfolioCard
              equity={currentEquity}
              cash={currentCash}
              unrealizedPnl={liveData?.unrealized_pnl ?? snapshot?.unrealizedPnl ?? 0}
              realizedPnl={liveData?.realized_pnl ?? snapshot?.realizedPnl ?? 0}
              mode={currentMode}
              initialCapital={initialCapital}
            />
            <RegimeIndicator regime={currentRegime} />
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Quick Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Open Positions</span>
                  <span className="text-sm text-white font-medium">
                    {positions.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Closed Trades</span>
                  <span className="text-sm text-white font-medium">
                    {liveData?.total_trades ?? trades.filter((t) => t.status === "closed").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Strategies Active</span>
                  <span className="text-sm text-white font-medium">
                    {liveData
                      ? Object.values(liveData.strategies || {}).filter((s: any) => s.active).length
                      : strategies.filter((s) => s.status === "active").length}
                    /{Object.keys(liveData?.strategies ?? {}).length || 4}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">Symbols Tracked</span>
                  <span className="text-sm text-white font-medium">
                    {liveData?.tracked_symbols ?? Object.keys(prices).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-white/60">AI Predictions</span>
                  <span className="text-sm text-white font-medium">
                    {livePredictions.length || predictions.length}
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
          <EquityChart
            curve={liveData?.equity_curve}
            snapshotEquity={snapshot?.equity}
            initialCapital={initialCapital}
          />

          {/* Row 3: Live Prices Grid */}
          <PriceGrid
            prices={prices}
            predictions={livePredictions}
          />

          {/* Row 4: Open Positions */}
          <PositionTable positions={positions} />
        </div>
      )}

      {tab === "strategies" && (
        <StrategyCards
          strategies={strategies}
          liveStrategies={liveData?.strategies}
          regime={currentRegime}
        />
      )}

      {tab === "trades" && (
        <TradeHistory trades={trades} />
      )}

      {tab === "predictions" && (
        <PredictionScorecard
          predictions={predictions}
          livePredictions={livePredictions}
        />
      )}
    </div>
  );
}
