"use client";

import { useState, useEffect } from "react";

interface AccuracyBucket {
  total: number;
  accurate: number;
  rate: number;
}

interface ConfidenceBucket extends AccuracyBucket {
  range: string;
}

interface RecentValidation {
  id: string;
  category: string;
  signal: string;
  scope: string;
  title: string;
  confidence: number;
  wasAccurate: boolean;
  createdAt: string;
  archivedAt: string;
}

interface AccuracyData {
  period: { days: number; since: string };
  overall: AccuracyBucket & { unvalidated: number };
  byCategory: Record<string, AccuracyBucket>;
  byScope: Record<string, AccuracyBucket>;
  bySignalType: Record<string, AccuracyBucket>;
  confidenceCalibration: ConfidenceBucket[];
  recentValidations: RecentValidation[];
}

function AccuracyRing({ rate, size = 64, label }: { rate: number; size?: number; label: string }) {
  const pct = Math.round(rate * 100);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - rate * circumference;

  const color =
    rate >= 0.7 ? "text-green-400" :
    rate >= 0.5 ? "text-yellow-400" :
    rate > 0 ? "text-red-400" :
    "text-white/20";

  const strokeColor =
    rate >= 0.7 ? "stroke-green-400" :
    rate >= 0.5 ? "stroke-yellow-400" :
    rate > 0 ? "stroke-red-400" :
    "stroke-white/10";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="currentColor"
            strokeWidth={4} className="text-white/5"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${strokeColor} transition-all duration-1000`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${color}`}>
            {rate > 0 ? `${pct}%` : "—"}
          </span>
        </div>
      </div>
      <span className="text-[9px] text-white/40 text-center leading-tight">{label}</span>
    </div>
  );
}

function CategoryBar({ label, stats }: { label: string; stats: AccuracyBucket }) {
  const pct = Math.round(stats.rate * 100);
  const color =
    stats.rate >= 0.7 ? "bg-green-500/60" :
    stats.rate >= 0.5 ? "bg-yellow-500/60" :
    "bg-red-500/60";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-20 shrink-0 capitalize">
        {label.replace(/_/g, " ")}
      </span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-[10px] text-white/50 w-16 text-right">
        {pct}% ({stats.accurate}/{stats.total})
      </span>
    </div>
  );
}

function ConfidenceCalibrationChart({ buckets }: { buckets: ConfidenceBucket[] }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-white/30">Confidence Calibration</span>
      {buckets.map((b) => {
        const expectedMid = (parseFloat(b.range.split("-")[0]) + parseFloat(b.range.split("-")[1])) / 2;
        const isCalibrated = b.total > 0 && Math.abs(b.rate - expectedMid) < 0.2;

        return (
          <div key={b.range} className="flex items-center gap-2">
            <span className="text-[9px] text-white/30 w-10 shrink-0">{b.range}</span>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden relative">
              {/* Expected position marker */}
              <div
                className="absolute top-0 w-px h-full bg-white/20"
                style={{ left: `${expectedMid * 100}%` }}
              />
              {/* Actual accuracy bar */}
              {b.total > 0 && (
                <div
                  className={`h-full rounded-full ${isCalibrated ? "bg-cyan-500/60" : "bg-orange-500/60"}`}
                  style={{ width: `${Math.max(b.rate * 100, 2)}%` }}
                />
              )}
            </div>
            <span className="text-[9px] text-white/30 w-14 text-right">
              {b.total > 0 ? `${Math.round(b.rate * 100)}% (${b.total})` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RecentValidationList({ validations }: { validations: RecentValidation[] }) {
  if (validations.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-white/30">Recent Validations</span>
      <div className="space-y-0.5 max-h-32 overflow-y-auto">
        {validations.map((v) => (
          <div key={v.id} className="flex items-center gap-2 py-0.5">
            <span className={`text-[10px] ${v.wasAccurate ? "text-green-400" : "text-red-400"}`}>
              {v.wasAccurate ? "\u2713" : "\u2717"}
            </span>
            <span className={`text-[9px] px-1 py-px rounded ${
              v.signal === "buy" ? "bg-green-500/20 text-green-300" :
              v.signal === "sell" ? "bg-red-500/20 text-red-300" :
              "bg-yellow-500/20 text-yellow-300"
            }`}>
              {v.signal}
            </span>
            <span className="text-[10px] text-white/50 truncate flex-1">{v.title}</span>
            <span className="text-[9px] text-white/20">
              {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccuracyTracker() {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/markets/accuracy?days=90")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg bg-white/5 border border-white/5 p-4 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-32 mb-3" />
        <div className="h-20 bg-white/5 rounded" />
      </div>
    );
  }

  if (!data || data.overall.total === 0) {
    return (
      <div className="rounded-lg bg-white/5 border border-white/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/50">Prediction Accuracy</span>
          <span className="text-[9px] text-white/20 bg-white/5 px-2 py-0.5 rounded">
            Self-Improving
          </span>
        </div>
        <p className="text-[10px] text-white/30">
          Collecting prediction data... Accuracy tracking begins after signals are validated against actual market outcomes (7+ days).
          {data && data.overall.unvalidated > 0 && (
            <span className="text-cyan-400/50"> {data.overall.unvalidated} signals pending validation.</span>
          )}
        </p>
      </div>
    );
  }

  const categoryEntries = Object.entries(data.byCategory).sort((a, b) => b[1].total - a[1].total);
  const signalEntries = Object.entries(data.bySignalType);

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">Prediction Accuracy</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/20 bg-white/5 px-2 py-0.5 rounded">
            Self-Improving
          </span>
          <span className="text-[9px] text-white/30">
            {data.overall.total} validated / {data.overall.unvalidated} pending
          </span>
        </div>
      </div>

      {/* Top row: Overall + Scope + Signal Type rings */}
      <div className="flex items-start justify-around">
        <AccuracyRing rate={data.overall.rate} size={72} label="Overall" />
        {Object.entries(data.byScope).map(([scope, stats]) => (
          <AccuracyRing
            key={scope}
            rate={stats.rate}
            size={56}
            label={scope === "local_kc" ? "KC Local" : "National"}
          />
        ))}
        {signalEntries.map(([sig, stats]) => (
          <AccuracyRing
            key={sig}
            rate={stats.rate}
            size={48}
            label={sig.charAt(0).toUpperCase() + sig.slice(1)}
          />
        ))}
      </div>

      {/* Category breakdown */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-white/30">By Category</span>
        {categoryEntries.map(([cat, stats]) => (
          <CategoryBar key={cat} label={cat} stats={stats} />
        ))}
      </div>

      {/* Confidence calibration */}
      {data.confidenceCalibration && (
        <ConfidenceCalibrationChart buckets={data.confidenceCalibration} />
      )}

      {/* Recent validations */}
      <RecentValidationList validations={data.recentValidations} />
    </div>
  );
}
