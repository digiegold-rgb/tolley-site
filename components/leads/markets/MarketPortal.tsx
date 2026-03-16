"use client";

import { useState, useEffect, createContext, useContext } from "react";
import dynamic from "next/dynamic";
import MarketHealthGauge from "./MarketHealthGauge";
import SignalPanel from "./SignalPanel";
import StockTicker from "./StockTicker";
import RateTracker from "./RateTracker";
import EconomicIndicators from "./EconomicIndicators";
import VideoAnalysisList from "./VideoAnalysisList";
import BlogFeed from "./BlogFeed";
import ManualInputForm from "./ManualInputForm";
import SourceManager from "./SourceManager";
import { useSnapshotHistory, type SnapshotHistoryPoint } from "./hooks/useMarketData";

// Lazy-load heavy chart/panel components
const RateTrendChart = dynamic(() => import("./charts/RateTrendChart"), { ssr: false });
const HealthTrendChart = dynamic(() => import("./charts/HealthTrendChart"), { ssr: false });
const MomentumGauge = dynamic(() => import("./charts/MomentumGauge"), { ssr: false });
const SentimentAreaChart = dynamic(() => import("./charts/SentimentAreaChart"), { ssr: false });
const SignalTimeline = dynamic(() => import("./charts/SignalTimeline"), { ssr: false });
const ComparativeOverlay = dynamic(() => import("./charts/ComparativeOverlay"), { ssr: false });
const DailyDigestPanel = dynamic(() => import("./panels/DailyDigestPanel"), { ssr: false });
const TopMoversPanel = dynamic(() => import("./panels/TopMoversPanel"), { ssr: false });
const PredictiveScoreCard = dynamic(() => import("./panels/PredictiveScoreCard"), { ssr: false });
const AccuracyTracker = dynamic(() => import("./panels/AccuracyTracker"), { ssr: false });
const AdsDashboard = dynamic(() => import("./ads/AdsDashboard"), { ssr: false });

type Tab = "dashboard" | "deep-dive" | "ads" | "news" | "sources";

// Period context for global period selector
const PeriodContext = createContext<{ days: number; setDays: (d: number) => void }>({
  days: 30,
  setDays: () => {},
});

export function usePeriod() {
  return useContext(PeriodContext);
}

interface Snapshot {
  nationalHealth: number | null;
  localKcHealth: number | null;
  mortgage30yr: number | null;
  mortgage15yr: number | null;
  treasury10yr: number | null;
  treasury30yr: number | null;
  unemployment: number | null;
  cpi: number | null;
  consumerSentiment: number | null;
  housingStarts: number | null;
  tickers: Record<string, { price: number; change: number; changePercent: number }> | null;
  summary: string | null;
  updatedAt: string;
  momentum?: number | null;
  healthDelta?: number | null;
  kcHealthDelta?: number | null;
  sentimentBullPct?: number | null;
  sentimentBearPct?: number | null;
  articleCount?: number;
}

interface Signal {
  id: string;
  signal: string;
  confidence: number;
  scope: string;
  category: string;
  title: string;
  reasoning: string;
  timeHorizon?: string;
}

interface DataPoint {
  id: string;
  type: string;
  title: string;
  url?: string;
  summary?: string;
  signal?: string;
  signalConfidence?: number;
  sentiment?: number;
  numericValue?: number;
  changePercent?: number;
  publishedAt?: string;
  tags?: string[];
  createdAt: string;
}

interface Props {
  initialSnapshot: Snapshot | null;
  initialSignals: Signal[];
  initialDataPoints: DataPoint[];
}

function PeriodSelector({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1">
      {[
        { label: "7d", value: 7 },
        { label: "30d", value: 30 },
        { label: "90d", value: 90 },
      ].map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-2.5 py-1 text-[10px] rounded-md font-medium transition-colors ${
            days === p.value
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
              : "text-white/30 hover:text-white/50 border border-transparent"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function MarketPortal({ initialSnapshot, initialSignals, initialDataPoints }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [signals, setSignals] = useState(initialSignals);
  const [dataPoints, setDataPoints] = useState(initialDataPoints);
  const [periodDays, setPeriodDays] = useState(30);

  const { data: historyData } = useSnapshotHistory(periodDays);
  const snapshotHistory: SnapshotHistoryPoint[] = historyData?.snapshots || [];

  // Refresh all data
  const refreshData = async () => {
    try {
      const [snapRes, sigRes, dpRes] = await Promise.all([
        fetch("/api/markets/snapshot/latest"),
        fetch("/api/markets/signals"),
        fetch("/api/markets?limit=100"),
      ]);
      if (snapRes.ok) {
        const data = await snapRes.json();
        if (data.snapshot) setSnapshot(data.snapshot);
      }
      if (sigRes.ok) {
        const data = await sigRes.json();
        setSignals(data.signals || []);
      }
      if (dpRes.ok) {
        const data = await dpRes.json();
        setDataPoints(data.dataPoints || []);
      }
    } catch { /* silent */ }
  };

  // Poll every 60s
  useEffect(() => {
    const interval = setInterval(refreshData, 60000);
    return () => clearInterval(interval);
  }, []);

  const videos = dataPoints.filter((d) => d.type === "video_analysis");
  const articles = dataPoints.filter((d) => d.type === "article_summary");
  const econIndicators = dataPoints.filter((d) => d.type === "economic_indicator");

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "deep-dive", label: "Deep Dive" },
    { id: "ads", label: "Google Ads" },
    { id: "news", label: `News & Videos (${articles.length + videos.length})` },
    { id: "sources", label: "Sources" },
  ];

  return (
    <PeriodContext.Provider value={{ days: periodDays, setDays: setPeriodDays }}>
      <div className="space-y-4">
        {/* Tab bar + period selector */}
        <div className="flex items-center justify-between border-b border-white/10 pb-px">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t.id
                    ? "text-cyan-300 bg-cyan-500/10 border-b-2 border-cyan-400"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {(tab === "dashboard" || tab === "deep-dive") && (
            <PeriodSelector days={periodDays} onChange={setPeriodDays} />
          )}
        </div>

        {/* Dashboard tab — dense Bloomberg-style grid */}
        {tab === "dashboard" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Daily digest banner */}
            <DailyDigestPanel />

            {/* Top row: Gauges + Momentum + Rate Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Health Gauges */}
              <div className="lg:col-span-3 rounded-lg bg-white/5 border border-white/5 p-4">
                <div className="flex gap-4 justify-center">
                  <MarketHealthGauge
                    label="National"
                    value={snapshot?.nationalHealth ?? null}
                    color="#22d3ee"
                    delta={snapshot?.healthDelta}
                  />
                  <MarketHealthGauge
                    label="Kansas City"
                    value={snapshot?.localKcHealth ?? null}
                    color="#a78bfa"
                    delta={snapshot?.kcHealthDelta}
                  />
                </div>
                {snapshot?.summary && (
                  <p className="text-[10px] text-white/40 mt-3 line-clamp-3">{snapshot.summary}</p>
                )}
              </div>

              {/* Momentum Gauge */}
              <div className="lg:col-span-3 rounded-lg bg-white/5 border border-white/5 p-4 flex items-center justify-center">
                <MomentumGauge value={snapshot?.momentum ?? null} />
              </div>

              {/* Rate Trend Chart */}
              <div className="lg:col-span-6">
                <RateTrendChart snapshots={snapshotHistory} />
              </div>
            </div>

            {/* Active Signals — horizontal scroll */}
            <div>
              <h3 className="text-xs font-medium text-white/50 mb-2">Active Signals</h3>
              <div className="overflow-x-auto pb-2">
                <div className="min-w-max">
                  <SignalPanel signals={signals} />
                </div>
              </div>
            </div>

            {/* Middle row: Health Trend + Stock Tickers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <HealthTrendChart snapshots={snapshotHistory} />
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-medium text-white/50 mb-2">Housing ETFs & Builders</h3>
                  <StockTicker tickers={snapshot?.tickers ?? null} snapshotHistory={snapshotHistory} />
                </div>
                <TopMoversPanel />
              </div>
            </div>

            {/* Rates + Economic Indicators */}
            <div>
              <h3 className="text-xs font-medium text-white/50 mb-2">Rates</h3>
              <RateTracker
                mortgage30yr={snapshot?.mortgage30yr ?? null}
                mortgage15yr={snapshot?.mortgage15yr ?? null}
                treasury10yr={snapshot?.treasury10yr ?? null}
                treasury30yr={snapshot?.treasury30yr ?? null}
              />
            </div>

            <div>
              <h3 className="text-xs font-medium text-white/50 mb-2">Economic Indicators</h3>
              <EconomicIndicators
                unemployment={snapshot?.unemployment ?? null}
                cpi={snapshot?.cpi ?? null}
                consumerSentiment={snapshot?.consumerSentiment ?? null}
                housingStarts={snapshot?.housingStarts ?? null}
                dataPoints={econIndicators}
                snapshotHistory={snapshotHistory}
              />
            </div>

            {/* Prediction Accuracy */}
            <AccuracyTracker />
          </div>
        )}

        {/* Deep Dive tab — expanded charts with period selectors */}
        {tab === "deep-dive" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PredictiveScoreCard momentum={snapshot?.momentum ?? null} />
              <TopMoversPanel />
            </div>

            <RateTrendChart snapshots={snapshotHistory} />
            <HealthTrendChart snapshots={snapshotHistory} />
            <SentimentAreaChart />
            <SignalTimeline />
            <AccuracyTracker />
            <ComparativeOverlay snapshots={snapshotHistory} />

            {/* Rates detail */}
            <div>
              <h3 className="text-xs font-medium text-white/50 mb-2">Current Rates</h3>
              <RateTracker
                mortgage30yr={snapshot?.mortgage30yr ?? null}
                mortgage15yr={snapshot?.mortgage15yr ?? null}
                treasury10yr={snapshot?.treasury10yr ?? null}
                treasury30yr={snapshot?.treasury30yr ?? null}
              />
            </div>

            {/* Full indicators */}
            <div>
              <h3 className="text-xs font-medium text-white/50 mb-2">Economic Indicators</h3>
              <EconomicIndicators
                unemployment={snapshot?.unemployment ?? null}
                cpi={snapshot?.cpi ?? null}
                consumerSentiment={snapshot?.consumerSentiment ?? null}
                housingStarts={snapshot?.housingStarts ?? null}
                dataPoints={econIndicators}
                snapshotHistory={snapshotHistory}
              />
            </div>

            <div>
              <h3 className="text-xs font-medium text-white/50 mb-2">Stock Tickers</h3>
              <StockTicker tickers={snapshot?.tickers ?? null} snapshotHistory={snapshotHistory} />
            </div>
          </div>
        )}

        {/* Google Ads tab */}
        {tab === "ads" && (
          <div className="animate-in fade-in duration-300">
            <AdsDashboard />
          </div>
        )}

        {/* News & Videos tab */}
        {tab === "news" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <ManualInputForm onDataAdded={refreshData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-medium text-white/50 mb-2">Articles ({articles.length})</h3>
                <BlogFeed articles={articles} />
              </div>
              <div>
                <h3 className="text-xs font-medium text-white/50 mb-2">Video Analysis ({videos.length})</h3>
                <VideoAnalysisList videos={videos} />
              </div>
            </div>
          </div>
        )}

        {/* Sources tab */}
        {tab === "sources" && (
          <div className="animate-in fade-in duration-300">
            <SourceManager onSourceAdded={refreshData} />
          </div>
        )}
      </div>
    </PeriodContext.Provider>
  );
}
