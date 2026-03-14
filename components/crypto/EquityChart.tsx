"use client";

interface Props {
  curve?: [string, number][];
  snapshotEquity?: number | null;
  initialCapital?: number;
}

export default function EquityChart({ curve, snapshotEquity, initialCapital = 10000 }: Props) {
  const data = curve && curve.length > 2 ? curve : null;

  if (!data) {
    return (
      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Equity Curve</h3>
        <div className="h-48 flex items-center justify-center text-white/20 text-sm">
          {snapshotEquity
            ? `Current equity: $${snapshotEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })} — chart populates after a few minutes of trading`
            : "Engine starting up — equity curve will appear shortly"}
        </div>
      </div>
    );
  }

  const values = data.map((d) => d[1]);
  const allValues = [...values, initialCapital];
  const min = Math.min(...allValues) * 0.998;
  const max = Math.max(...allValues) * 1.002;
  const range = max - min || 1;
  const w = 800;
  const h = 200;
  const pad = 4;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${w - pad},${h - pad} L${pad},${h - pad} Z`;

  // Initial capital reference line
  const capY = pad + (h - pad * 2) - ((initialCapital - min) / range) * (h - pad * 2);

  const currentEquity = values[values.length - 1];
  const isProfit = currentEquity >= initialCapital;
  const gradientColor = isProfit ? "#22c55e" : "#ef4444";

  // Time labels
  const first = new Date(data[0][0]);
  const last = new Date(data[data.length - 1][0]);
  const duration = (last.getTime() - first.getTime()) / 1000 / 60; // minutes

  return (
    <div className="crypto-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs text-white/40 uppercase tracking-wider">Equity Curve</h3>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-white/20">{values.length} data points</span>
          <span className="text-[10px] text-white/20">{duration.toFixed(0)}min span</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48" preserveAspectRatio="none">
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={gradientColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={pad}
            y1={pad + (h - pad * 2) * pct}
            x2={w - pad}
            y2={pad + (h - pad * 2) * pct}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        ))}
        {/* Initial capital reference line */}
        <line
          x1={pad}
          y1={capY}
          x2={w - pad}
          y2={capY}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.3"
        />
        <text x={w - pad - 2} y={capY - 4} textAnchor="end" fill="#f59e0b" opacity="0.4" fontSize="9">
          ${initialCapital.toLocaleString()}
        </text>
        {/* Area fill */}
        <path d={areaPath} fill="url(#equityGradient)" />
        {/* Equity line */}
        <path
          d={linePath}
          stroke={gradientColor}
          strokeWidth="2"
          fill="none"
        />
        {/* Current value dot */}
        <circle
          cx={parseFloat(points[points.length - 1].split(",")[0])}
          cy={parseFloat(points[points.length - 1].split(",")[1])}
          r="3"
          fill={gradientColor}
        />
      </svg>
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>{first.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span className={`font-medium ${isProfit ? "text-green-400/60" : "text-red-400/60"}`}>
          ${currentEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span>{last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}
