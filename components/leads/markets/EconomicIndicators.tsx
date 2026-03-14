"use client";

import IndicatorSparkline from "./charts/IndicatorSparkline";
import type { SnapshotHistoryPoint } from "./hooks/useMarketData";

interface DataPoint {
  id: string;
  type: string;
  title: string;
  numericValue?: number;
  changePercent?: number;
  signal?: string;
  tags?: string[];
  createdAt?: string;
}

interface Props {
  unemployment: number | null;
  cpi: number | null;
  consumerSentiment: number | null;
  housingStarts: number | null;
  dataPoints?: DataPoint[];
  snapshotHistory?: SnapshotHistoryPoint[];
}

const INDICATOR_FREQUENCY: Record<string, number> = {
  fedfunds: 1, unrate: 30, payems: 30, icsa: 7,
  cpiaucsl: 30, umcsent: 30, cscicp03usm665s: 30,
  gdpc1: 90, m2sl: 30, mspus: 90, csushpisa: 30,
  houst: 30, permit: 30, msacsr: 30,
  rrvrusq156n: 90, rhorusq156n: 90, t10y2y: 1, dexuseu: 1,
};

function getFreshnessStatus(lastUpdated: string | undefined, tag: string): "fresh" | "overdue" | "stale" {
  if (!lastUpdated) return "stale";
  const freq = INDICATOR_FREQUENCY[tag] || 30;
  const ageDays = (Date.now() - new Date(lastUpdated).getTime()) / 86400000;
  const ratio = ageDays / freq;
  if (ratio <= 1.2) return "fresh";
  if (ratio <= 2.5) return "overdue";
  return "stale";
}

const FRESHNESS_COLORS: Record<string, string> = {
  fresh: "bg-green-400",
  overdue: "bg-amber-400",
  stale: "bg-red-400",
};

function IndicatorCard({
  label,
  value,
  format,
  change,
  signal,
  sparkData,
  freshness,
}: {
  label: string;
  value: number | null;
  format: (v: number) => string;
  change?: number;
  signal?: string;
  sparkData?: number[];
  freshness?: "fresh" | "overdue" | "stale";
}) {
  const signalColors: Record<string, string> = {
    buy: "text-green-400",
    sell: "text-red-400",
    hold: "text-amber-400",
    neutral: "text-white/40",
  };

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] text-white/40 uppercase tracking-wider truncate" title={label}>
          {label}
        </div>
        {freshness && (
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${FRESHNESS_COLORS[freshness]}`} title={freshness} />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-bold text-white">
          {value !== null ? format(value) : "—"}
        </div>
        {sparkData && sparkData.length >= 2 && (
          <IndicatorSparkline data={sparkData} width={60} height={20} />
        )}
      </div>
      {(change !== undefined || signal) && (
        <div className="flex items-center gap-2 mt-1">
          {change !== undefined && (
            <span className={`text-[10px] font-medium ${change >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </span>
          )}
          {signal && signal !== "neutral" && (
            <span className={`text-[10px] font-medium uppercase ${signalColors[signal] || "text-white/30"}`}>
              {signal}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Mapping from tag to snapshot field for sparkline data
const TAG_TO_SNAPSHOT_FIELD: Record<string, keyof SnapshotHistoryPoint> = {
  unrate: "unemployment",
  cpiaucsl: "cpi",
  umcsent: "consumerSentiment",
  houst: "housingStarts",
};

const CATEGORIES: { label: string; tags: string[]; format: (v: number) => string }[] = [
  { label: "Fed Funds Rate", tags: ["fedfunds"], format: (v) => `${v.toFixed(2)}%` },
  { label: "Unemployment", tags: ["unrate"], format: (v) => `${v.toFixed(1)}%` },
  { label: "Nonfarm Payrolls", tags: ["payems"], format: (v) => `${(v / 1000).toFixed(0)}K` },
  { label: "Jobless Claims", tags: ["icsa"], format: (v) => `${(v / 1000).toFixed(0)}K` },
  { label: "CPI", tags: ["cpiaucsl"], format: (v) => v.toFixed(1) },
  { label: "Consumer Sentiment", tags: ["umcsent"], format: (v) => v.toFixed(1) },
  { label: "Consumer Confidence", tags: ["cscicp03usm665s"], format: (v) => v.toFixed(1) },
  { label: "Real GDP", tags: ["gdpc1"], format: (v) => `$${(v / 1000).toFixed(1)}T` },
  { label: "M2 Money Supply", tags: ["m2sl"], format: (v) => `$${(v / 1000).toFixed(1)}T` },
  { label: "Median Home Price", tags: ["mspus"], format: (v) => `$${(v / 1000).toFixed(0)}K` },
  { label: "Case-Shiller Index", tags: ["csushpisa"], format: (v) => v.toFixed(1) },
  { label: "Housing Starts", tags: ["houst"], format: (v) => `${v.toFixed(0)}K` },
  { label: "Building Permits", tags: ["permit"], format: (v) => `${v.toFixed(0)}K` },
  { label: "New Home Supply", tags: ["msacsr"], format: (v) => `${v.toFixed(1)} mo` },
  { label: "Rental Vacancy", tags: ["rrvrusq156n"], format: (v) => `${v.toFixed(1)}%` },
  { label: "Homeownership Rate", tags: ["rhorusq156n"], format: (v) => `${v.toFixed(1)}%` },
  { label: "10yr-2yr Spread", tags: ["t10y2y"], format: (v) => `${v.toFixed(2)}%` },
  { label: "USD/EUR", tags: ["dexuseu"], format: (v) => v.toFixed(4) },
];

export default function EconomicIndicators({
  unemployment,
  cpi,
  consumerSentiment,
  housingStarts,
  dataPoints,
  snapshotHistory,
}: Props) {
  // If we have data points, use the full grid
  if (dataPoints && dataPoints.length > 0) {
    const indicators = CATEGORIES.map((cat) => {
      const dp = dataPoints.find((d) =>
        d.tags?.some((t) => cat.tags.includes(t))
      );
      if (!dp) return null;

      const tag = cat.tags[0];
      const field = TAG_TO_SNAPSHOT_FIELD[tag];
      let sparkData: number[] | undefined;
      if (field && snapshotHistory) {
        sparkData = snapshotHistory
          .map((s) => s[field] as number | null)
          .filter((v): v is number => v !== null);
      }

      return {
        label: cat.label,
        value: dp.numericValue ?? null,
        format: cat.format,
        change: dp.changePercent,
        signal: dp.signal,
        sparkData,
        freshness: getFreshnessStatus(dp.createdAt, tag),
      };
    }).filter(Boolean) as {
      label: string;
      value: number | null;
      format: (v: number) => string;
      change?: number;
      signal?: string;
      sparkData?: number[];
      freshness?: "fresh" | "overdue" | "stale";
    }[];

    if (indicators.length > 0) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {indicators.map((ind) => (
            <IndicatorCard key={ind.label} {...ind} />
          ))}
        </div>
      );
    }
  }

  // Fallback to snapshot-only view
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <IndicatorCard label="Unemployment" value={unemployment} format={(v) => `${v.toFixed(1)}%`} />
      <IndicatorCard label="CPI" value={cpi} format={(v) => v.toFixed(1)} />
      <IndicatorCard label="Consumer Sentiment" value={consumerSentiment} format={(v) => v.toFixed(1)} />
      <IndicatorCard label="Housing Starts (K)" value={housingStarts} format={(v) => `${v.toFixed(0)}K`} />
    </div>
  );
}
