"use client";

interface ValidationData {
  days_elapsed: number;
  days_required: number;
  days_remaining: number;
  sharpe: number;
  sharpe_required: number;
  sharpe_pass: boolean;
  trade_count: number;
  trades_required: number;
  drawdown_pct: number;
  max_drawdown_pct: number;
  ready_for_live: boolean;
  blockers: string[];
  started_at: string | null;
}

interface Props {
  validation: ValidationData | null;
}

export default function ValidationProgress({ validation }: Props) {
  if (!validation) {
    return (
      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          Validation Progress
        </h3>
        <p className="text-sm text-white/20 text-center py-4">No validation data</p>
      </div>
    );
  }

  const daysPct = Math.min(100, (validation.days_elapsed / validation.days_required) * 100);
  const sharpePct = Math.min(100, (validation.sharpe / validation.sharpe_required) * 100);
  const tradesPct = Math.min(100, (validation.trade_count / validation.trades_required) * 100);

  return (
    <div className="crypto-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-white/40 uppercase tracking-wider">
          Validation Progress
        </h3>
        {validation.ready_for_live ? (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
            Ready for Live
          </span>
        ) : (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
            Paper Mode
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Days */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50">Days</span>
            <span className="text-white/70">
              {validation.days_elapsed.toFixed(1)} / {validation.days_required}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                daysPct >= 100 ? "bg-green-400" : "bg-amber-400"
              }`}
              style={{ width: `${daysPct}%` }}
            />
          </div>
        </div>

        {/* Sharpe */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50">Sharpe Ratio</span>
            <span className={`${validation.sharpe_pass ? "text-green-400" : "text-white/70"}`}>
              {validation.sharpe.toFixed(2)} / {validation.sharpe_required}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                validation.sharpe_pass ? "bg-green-400" : validation.sharpe > 0 ? "bg-amber-400" : "bg-red-400"
              }`}
              style={{ width: `${Math.max(0, sharpePct)}%` }}
            />
          </div>
        </div>

        {/* Trades */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50">Trades</span>
            <span className="text-white/70">
              {validation.trade_count} / {validation.trades_required}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                tradesPct >= 100 ? "bg-green-400" : "bg-amber-400"
              }`}
              style={{ width: `${tradesPct}%` }}
            />
          </div>
        </div>

        {/* Drawdown */}
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Max Drawdown</span>
          <span className={`${
            validation.drawdown_pct > validation.max_drawdown_pct ? "text-red-400" : "text-white/70"
          }`}>
            {validation.drawdown_pct.toFixed(1)}% / {validation.max_drawdown_pct}%
          </span>
        </div>

        {/* Blockers */}
        {validation.blockers.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/5">
            <p className="text-[10px] text-white/30 uppercase mb-1">Blockers</p>
            {validation.blockers.map((b, i) => (
              <p key={i} className="text-xs text-amber-400/70">{b}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
