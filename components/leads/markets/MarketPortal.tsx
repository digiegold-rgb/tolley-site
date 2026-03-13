"use client";

import { useState, useEffect } from "react";
import MarketHealthGauge from "./MarketHealthGauge";
import SignalPanel from "./SignalPanel";
import StockTicker from "./StockTicker";
import RateTracker from "./RateTracker";
import EconomicIndicators from "./EconomicIndicators";
import VideoAnalysisList from "./VideoAnalysisList";
import BlogFeed from "./BlogFeed";
import ManualInputForm from "./ManualInputForm";
import SourceManager from "./SourceManager";

type Tab = "overview" | "videos" | "stocks" | "news" | "sources";

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

export default function MarketPortal({ initialSnapshot, initialSignals, initialDataPoints }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [signals, setSignals] = useState(initialSignals);
  const [dataPoints, setDataPoints] = useState(initialDataPoints);

  // Refresh all data
  const refreshData = async () => {
    try {
      const [snapRes, sigRes, dpRes] = await Promise.all([
        fetch("/api/markets/snapshot/latest"),
        fetch("/api/markets/signals"),
        fetch("/api/markets?limit=50"),
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
    { id: "overview", label: "Overview" },
    { id: "videos", label: `Videos (${videos.length})` },
    { id: "stocks", label: "Stocks & Rates" },
    { id: "news", label: `News (${articles.length})` },
    { id: "sources", label: "Sources" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10 pb-px">
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

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Health gauges + summary */}
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex gap-6">
              <MarketHealthGauge label="National" value={snapshot?.nationalHealth ?? null} color="#22d3ee" />
              <MarketHealthGauge label="Kansas City" value={snapshot?.localKcHealth ?? null} color="#a78bfa" />
            </div>
            {snapshot?.summary && (
              <div className="flex-1 rounded-lg bg-white/5 border border-white/5 p-4">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Daily Summary</div>
                <p className="text-sm text-white/70">{snapshot.summary}</p>
                <span className="text-[10px] text-white/20 mt-2 inline-block">
                  Updated: {new Date(snapshot.updatedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Signals */}
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-3">Active Signals</h3>
            <SignalPanel signals={signals} />
          </div>

          {/* Stock tickers */}
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-3">Housing ETFs & Builders</h3>
            <StockTicker tickers={snapshot?.tickers ?? null} />
          </div>

          {/* Rates */}
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-3">Rates</h3>
            <RateTracker
              mortgage30yr={snapshot?.mortgage30yr ?? null}
              mortgage15yr={snapshot?.mortgage15yr ?? null}
              treasury10yr={snapshot?.treasury10yr ?? null}
              treasury30yr={snapshot?.treasury30yr ?? null}
            />
          </div>

          {/* Economic */}
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-3">Economic Indicators</h3>
            <EconomicIndicators
              unemployment={snapshot?.unemployment ?? null}
              cpi={snapshot?.cpi ?? null}
              consumerSentiment={snapshot?.consumerSentiment ?? null}
              housingStarts={snapshot?.housingStarts ?? null}
              dataPoints={econIndicators}
            />
          </div>

          {/* Manual input */}
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-3">Add Data</h3>
            <ManualInputForm onDataAdded={refreshData} />
          </div>
        </div>
      )}

      {/* Videos tab */}
      {tab === "videos" && (
        <div className="space-y-4">
          <ManualInputForm onDataAdded={refreshData} />
          <VideoAnalysisList videos={videos} />
        </div>
      )}

      {/* Stocks & Rates tab */}
      {tab === "stocks" && (
        <div className="space-y-6">
          <StockTicker tickers={snapshot?.tickers ?? null} />
          <RateTracker
            mortgage30yr={snapshot?.mortgage30yr ?? null}
            mortgage15yr={snapshot?.mortgage15yr ?? null}
            treasury10yr={snapshot?.treasury10yr ?? null}
            treasury30yr={snapshot?.treasury30yr ?? null}
          />
          <EconomicIndicators
            unemployment={snapshot?.unemployment ?? null}
            cpi={snapshot?.cpi ?? null}
            consumerSentiment={snapshot?.consumerSentiment ?? null}
            housingStarts={snapshot?.housingStarts ?? null}
          />
        </div>
      )}

      {/* News tab */}
      {tab === "news" && (
        <div className="space-y-4">
          <ManualInputForm onDataAdded={refreshData} />
          <BlogFeed articles={articles} />
        </div>
      )}

      {/* Sources tab */}
      {tab === "sources" && <SourceManager onSourceAdded={refreshData} />}
    </div>
  );
}
