"use client";

interface Props {
  curve?: [string, number][];
  snapshotEquity?: number | null;
}

export default function EquityChart({ curve, snapshotEquity }: Props) {
  const data = curve && curve.length > 2 ? curve : null;

  if (!data) {
    return (
      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Equity Curve</h3>
        <div className="h-48 flex items-center justify-center text-white/20 text-sm">
          {snapshotEquity
            ? `Current equity: $${snapshotEquity.toLocaleString()}`
            : "Waiting for data..."}
        </div>
      </div>
    );
  }

  const values = data.map((d) => d[1]);
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const range = max - min || 1;
  const w = 800;
  const h = 200;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <div className="crypto-card">
      <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Equity Curve</h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} className="equity-area" />
        <path d={linePath} className="equity-line" />
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>${min.toFixed(0)}</span>
        <span>${max.toFixed(0)}</span>
      </div>
    </div>
  );
}
