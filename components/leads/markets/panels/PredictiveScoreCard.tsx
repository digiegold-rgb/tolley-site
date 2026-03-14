"use client";

interface Props {
  momentum: number | null;
  components?: {
    rate?: number;
    supply?: number;
    sentiment?: number;
    economic?: number;
    market?: number;
  };
}

function ComponentBar({ label, value }: { label: string; value: number }) {
  const normalized = (value + 100) / 200; // -100..+100 → 0..1
  const isPositive = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
        {/* Center mark */}
        <div className="absolute left-1/2 top-0 w-px h-full bg-white/10" />
        <div
          className={`absolute top-0 h-full rounded-full transition-all ${isPositive ? "bg-green-500/60" : "bg-red-500/60"}`}
          style={
            isPositive
              ? { left: "50%", width: `${normalized * 50}%` }
              : { right: "50%", width: `${(1 - normalized) * 50}%`, left: `${normalized * 100}%` }
          }
        />
      </div>
      <span className={`text-[10px] w-8 text-right ${isPositive ? "text-green-400/70" : "text-red-400/70"}`}>
        {value > 0 ? "+" : ""}{Math.round(value)}
      </span>
    </div>
  );
}

export default function PredictiveScoreCard({ momentum, components }: Props) {
  const score = momentum ?? 0;
  const color =
    score > 20 ? "text-green-400" :
    score > -20 ? "text-yellow-400" :
    "text-red-400";

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50">Predictive Score</span>
        <span className={`text-lg font-bold ${color}`}>
          {momentum !== null ? `${score > 0 ? "+" : ""}${Math.round(score)}` : "—"}
        </span>
      </div>
      {components && (
        <div className="space-y-1.5">
          <ComponentBar label="Rates" value={components.rate ?? 0} />
          <ComponentBar label="Supply" value={components.supply ?? 0} />
          <ComponentBar label="Sentiment" value={components.sentiment ?? 0} />
          <ComponentBar label="Economic" value={components.economic ?? 0} />
          <ComponentBar label="Market" value={components.market ?? 0} />
        </div>
      )}
    </div>
  );
}
