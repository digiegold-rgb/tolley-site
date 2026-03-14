"use client";

interface Change {
  strategy: string;
  param: string;
  old: number;
  new: number;
  reason: string;
}

interface OptimizationRun {
  id: number;
  regime: string;
  metrics: Record<string, any>;
  changes: Change[];
  rationale: string;
  created_at: string;
}

interface Props {
  history: OptimizationRun[];
}

export default function OptimizerHistory({ history }: Props) {
  if (!history || history.length === 0) {
    return (
      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
          AI Optimizer History
        </h3>
        <p className="text-sm text-white/20 text-center py-6">
          No optimization runs yet. The optimizer runs every 10 minutes after trades accumulate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="crypto-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs text-white/40 uppercase tracking-wider">
            AI Optimizer History
          </h3>
          <span className="text-[10px] text-white/20">
            {history.length} runs
          </span>
        </div>
      </div>

      {history.map((run) => {
        const date = new Date(run.created_at);
        const hasChanges = run.changes && run.changes.length > 0;

        return (
          <div
            key={run.id}
            className="crypto-card border-l-2"
            style={{
              borderLeftColor: hasChanges
                ? "rgba(245, 158, 11, 0.5)"
                : "rgba(255, 255, 255, 0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-white">
                  {date.toLocaleDateString()} {date.toLocaleTimeString()}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                  {run.regime || "UNKNOWN"}
                </span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  hasChanges
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-white/5 text-white/30"
                }`}
              >
                {hasChanges ? `${run.changes.length} changes` : "No changes"}
              </span>
            </div>

            {hasChanges && (
              <div className="space-y-1.5 mb-3">
                {run.changes.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs bg-white/[0.02] rounded px-2 py-1.5"
                  >
                    <span className="text-amber-400/70 font-mono">
                      {c.strategy}
                    </span>
                    <span className="text-white/30">.</span>
                    <span className="text-white/60 font-mono">{c.param}</span>
                    <span className="text-white/20 mx-1">{"\u2192"}</span>
                    <span className="text-red-400/50 line-through">
                      {typeof c.old === "number" ? c.old.toFixed(4) : c.old}
                    </span>
                    <span className="text-green-400">
                      {typeof c.new === "number" ? c.new.toFixed(4) : c.new}
                    </span>
                    {c.reason && (
                      <span className="text-white/20 text-[10px] ml-auto truncate max-w-[200px]">
                        {c.reason}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {run.rationale && (
              <p className="text-xs text-white/30 leading-relaxed">
                {run.rationale}
              </p>
            )}

            {run.metrics && Object.keys(run.metrics).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(run.metrics).map(([strat, m]: [string, any]) => (
                  <span
                    key={strat}
                    className="text-[10px] bg-white/[0.03] px-2 py-1 rounded text-white/30"
                  >
                    {strat}: {(m.win_rate * 100).toFixed(0)}% WR, ${m.total_pnl?.toFixed(2)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
