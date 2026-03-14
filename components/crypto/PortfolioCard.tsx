"use client";

interface Props {
  equity: number;
  cash: number;
  unrealizedPnl: number;
  realizedPnl: number;
  mode: string;
}

export default function PortfolioCard({ equity, cash, unrealizedPnl, realizedPnl, mode }: Props) {
  const totalPnl = unrealizedPnl + realizedPnl;
  const pnlColor = totalPnl >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="crypto-card crypto-glow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider">Portfolio</h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
            mode === "live"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}
        >
          {mode}
        </span>
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={`text-sm font-medium ${pnlColor}`}>
        {totalPnl >= 0 ? "+" : ""}
        ${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total P&L
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-white/30 uppercase">Cash</div>
          <div className="text-sm text-white/80">${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div className="text-[10px] text-white/30 uppercase">Unrealized</div>
          <div className={`text-sm ${unrealizedPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>
            {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
