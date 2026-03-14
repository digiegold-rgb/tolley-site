"use client";

interface Props {
  equity: number;
  cash: number;
  unrealizedPnl: number;
  realizedPnl: number;
  mode: string;
  initialCapital?: number;
}

export default function PortfolioCard({ equity, cash, unrealizedPnl, realizedPnl, mode, initialCapital = 10000 }: Props) {
  const totalPnl = equity - initialCapital;
  const totalPnlPct = ((equity - initialCapital) / initialCapital) * 100;
  const pnlColor = totalPnl >= 0 ? "text-green-400" : "text-red-400";
  const invested = equity - cash;

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
        ${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {" "}({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-[10px] text-white/30 uppercase">Cash</span>
          <span className="text-sm text-white/80">${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-white/30 uppercase">Invested</span>
          <span className="text-sm text-white/80">${invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-white/30 uppercase">Unrealized</span>
          <span className={`text-sm ${unrealizedPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>
            {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-white/30 uppercase">Realized</span>
          <span className={`text-sm ${realizedPnl >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>
            {realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(2)}
          </span>
        </div>
        {/* Progress bar: equity vs initial */}
        <div className="pt-2">
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totalPnl >= 0 ? "bg-green-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(Math.max((equity / initialCapital) * 100, 5), 150)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-white/15">$0</span>
            <span className="text-[9px] text-white/15">${initialCapital.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
