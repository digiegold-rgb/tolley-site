"use client";

interface EquityBreakdown {
  marketValue: number;
  marketValueSource: string;
  mortgageEstimate: number;
  mortgageMethod: string;
  equityEstimate: number;
  equityPercent: number;
  confidence: "high" | "medium" | "low";
  sources: string[];
}

interface EquityCardProps {
  equity: number | null;
  breakdown: EquityBreakdown | null;
}

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  return `$${n.toLocaleString()}`;
}

const confidenceColors = {
  high: "bg-green-500/20 text-green-300",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-orange-500/20 text-orange-300",
};

export default function EquityCard({ equity, breakdown }: EquityCardProps) {
  if (equity === null && !breakdown) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-medium text-white/40 mb-2">Estimated Equity</h3>
        <p className="text-white/30 text-sm">Insufficient data for equity estimation</p>
      </div>
    );
  }

  const equityValue = breakdown?.equityEstimate ?? equity ?? 0;
  const isPositive = equityValue >= 0;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-white/40">Estimated Equity</h3>
        {breakdown?.confidence && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColors[breakdown.confidence]}`}
          >
            {breakdown.confidence} confidence
          </span>
        )}
      </div>

      {/* Big equity number */}
      <div className="mb-6">
        <p
          className={`text-4xl font-bold ${
            isPositive ? "text-green-400" : "text-red-400"
          }`}
        >
          {formatCurrency(equityValue)}
        </p>
        {breakdown?.equityPercent !== undefined && (
          <p className="text-white/40 text-sm mt-1">
            {breakdown.equityPercent}% equity position
          </p>
        )}
      </div>

      {/* Breakdown */}
      {breakdown && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex justify-between items-baseline">
            <div>
              <p className="text-sm text-white/60">Market Value</p>
              <p className="text-xs text-white/30">{breakdown.marketValueSource}</p>
            </div>
            <p className="text-lg font-medium text-white/90">
              {formatCurrency(breakdown.marketValue)}
            </p>
          </div>

          <div className="flex justify-between items-baseline">
            <div>
              <p className="text-sm text-white/60">Est. Mortgage Balance</p>
              <p className="text-xs text-white/30 max-w-[200px] truncate" title={breakdown.mortgageMethod}>
                {breakdown.mortgageMethod}
              </p>
            </div>
            <p className="text-lg font-medium text-red-300/70">
              -{formatCurrency(breakdown.mortgageEstimate)}
            </p>
          </div>

          <div className="flex justify-between items-baseline border-t border-white/10 pt-3">
            <p className="text-sm font-medium text-white/80">Estimated Equity</p>
            <p className={`text-xl font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {formatCurrency(equityValue)}
            </p>
          </div>

          {/* Sources */}
          {breakdown.sources.length > 0 && (
            <p className="text-xs text-white/20 pt-2">
              Sources: {breakdown.sources.join(", ")}
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-white/15 mt-4">
        Estimates only. Verify with title company before making decisions.
      </p>
    </div>
  );
}
