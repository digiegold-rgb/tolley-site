"use client";

interface Signal {
  id: string;
  signal: string;
  confidence: number;
  scope: string;
  category: string;
  title: string;
  reasoning: string;
  timeHorizon?: string;
}

interface Props {
  signals: Signal[];
}

const signalColors: Record<string, { bg: string; text: string; border: string }> = {
  buy: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  sell: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  hold: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
};

export default function SignalPanel({ signals }: Props) {
  if (signals.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-sm">
        No active signals yet. Data collection will generate signals.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {signals.map((sig) => {
        const colors = signalColors[sig.signal] || signalColors.hold;
        return (
          <div
            key={sig.id}
            className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase ${colors.text}`}>
                {sig.signal}
              </span>
              <span className="text-[10px] text-white/30 capitalize">
                {sig.scope === "local_kc" ? "KC" : "National"}
              </span>
            </div>
            <p className="text-sm font-medium text-white mb-1">{sig.title}</p>
            <p className="text-xs text-white/40 mb-3 line-clamp-2">{sig.reasoning}</p>
            {/* Confidence bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${sig.signal === "buy" ? "bg-green-400" : sig.signal === "sell" ? "bg-red-400" : "bg-yellow-400"}`}
                  style={{ width: `${sig.confidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-white/30">{Math.round(sig.confidence * 100)}%</span>
            </div>
            {sig.timeHorizon && (
              <span className="inline-block mt-2 text-[10px] text-white/20 capitalize">
                {sig.timeHorizon.replace("_", " ")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
