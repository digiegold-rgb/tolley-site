"use client";

interface Props {
  regime: string;
}

const REGIME_CONFIG: Record<string, { color: string; bg: string; border: string; description: string }> = {
  TRENDING_UP: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    description: "Bullish trend detected — trend following & breakout active",
  },
  TRENDING_DOWN: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    description: "Bearish trend detected — arb & DCA active, reduced size",
  },
  RANGING: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    description: "Sideways market — mean reversion & arb active",
  },
  HIGH_VOLATILITY: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    description: "High volatility — arb only, positions 50% reduced",
  },
  UNKNOWN: {
    color: "text-white/40",
    bg: "bg-white/5",
    border: "border-white/10",
    description: "Regime not yet classified",
  },
};

export default function RegimeIndicator({ regime }: Props) {
  const cfg = REGIME_CONFIG[regime] || REGIME_CONFIG.UNKNOWN;

  return (
    <div className="crypto-card">
      <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">AI Regime</h3>
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`regime-badge ${cfg.bg} ${cfg.color} ${cfg.border} border`}
        >
          <span className="w-2 h-2 rounded-full bg-current pulse-gold" />
          {regime.replace("_", " ")}
        </span>
      </div>
      <p className="text-xs text-white/40 leading-relaxed">{cfg.description}</p>
    </div>
  );
}
