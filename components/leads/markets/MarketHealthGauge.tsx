"use client";

interface Props {
  label: string;
  value: number | null;
  color: string;
}

export default function MarketHealthGauge({ label, value, color }: Props) {
  const score = value ?? 50;
  const circumference = 2 * Math.PI * 40;
  const filled = (score / 100) * circumference;
  const statusText = score >= 70 ? "Bullish" : score >= 40 ? "Neutral" : "Bearish";
  const statusColor = score >= 70 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${filled} ${circumference - filled}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{value !== null ? Math.round(score) : "—"}</span>
          <span className={`text-[10px] font-medium ${statusColor}`}>{value !== null ? statusText : "N/A"}</span>
        </div>
      </div>
      <span className="text-xs text-white/50">{label}</span>
    </div>
  );
}
