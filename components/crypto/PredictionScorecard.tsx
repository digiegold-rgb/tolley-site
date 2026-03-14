"use client";

interface PredictionInfo {
  id: string;
  asset: string;
  direction: string;
  targetPrice: number;
  confidence: number;
  rationale: string | null;
  currentPrice: number;
  actualPrice: number | null;
  accuracy: number | null;
  status: string;
  targetDate: string;
  createdAt: string;
}

interface Props {
  predictions: PredictionInfo[];
}

export default function PredictionScorecard({ predictions }: Props) {
  const graded = predictions.filter((p) => p.status === "graded");
  const pending = predictions.filter((p) => p.status === "pending");

  const accurate = graded.filter((p) => (p.accuracy ?? 1) < 0.05);
  const bullish = graded.filter((p) => p.direction === "bullish");
  const bearish = graded.filter((p) => p.direction === "bearish");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Total</div>
          <div className="text-xl font-bold text-white">{predictions.length}</div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Accuracy</div>
          <div className="text-xl font-bold text-amber-400">
            {graded.length > 0 ? `${((accurate.length / graded.length) * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Bullish Calls</div>
          <div className="text-xl font-bold text-green-400">{bullish.length}</div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Bearish Calls</div>
          <div className="text-xl font-bold text-red-400">{bearish.length}</div>
        </div>
      </div>

      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Predictions</h3>
        {predictions.length === 0 ? (
          <p className="text-sm text-white/20 text-center py-6">No predictions yet</p>
        ) : (
          <div className="space-y-3">
            {predictions.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0"
              >
                <span
                  className={`text-xs font-bold uppercase w-12 ${
                    p.direction === "bullish"
                      ? "text-green-400"
                      : p.direction === "bearish"
                      ? "text-red-400"
                      : "text-white/40"
                  }`}
                >
                  {p.direction.slice(0, 4)}
                </span>
                <span className="text-sm text-white font-medium w-16">{p.asset}</span>
                <span className="text-sm text-white/60 flex-1">
                  Target: ${p.targetPrice.toLocaleString()} by{" "}
                  {new Date(p.targetDate).toLocaleDateString()}
                </span>
                <span className="text-xs text-amber-400/60">
                  {(p.confidence * 100).toFixed(0)}%
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    p.status === "graded"
                      ? (p.accuracy ?? 1) < 0.05
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  {p.status === "graded"
                    ? (p.accuracy ?? 1) < 0.05
                      ? "HIT"
                      : "MISS"
                    : "PENDING"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
