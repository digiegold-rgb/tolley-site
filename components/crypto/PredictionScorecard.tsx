"use client";

interface PredictionInfo {
  id?: string;
  asset?: string;
  symbol?: string;
  direction: string;
  targetPrice?: number;
  target_price?: number;
  confidence: number;
  rationale?: string | null;
  currentPrice?: number;
  current_price?: number;
  actualPrice?: number | null;
  accuracy?: number | null;
  status?: string;
  targetDate?: string;
  createdAt?: string;
  generated_at?: string;
  regime?: string;
}

interface Props {
  predictions: PredictionInfo[];
  livePredictions?: PredictionInfo[];
}

function normalizeDirection(d: string): string {
  const upper = d.toUpperCase();
  if (upper === "UP" || upper === "BULLISH") return "UP";
  if (upper === "DOWN" || upper === "BEARISH") return "DOWN";
  return "NEUTRAL";
}

function dirColor(d: string): string {
  const norm = normalizeDirection(d);
  if (norm === "UP") return "text-green-400";
  if (norm === "DOWN") return "text-red-400";
  return "text-white/40";
}

function dirBg(d: string): string {
  const norm = normalizeDirection(d);
  if (norm === "UP") return "bg-green-500/10 border-green-500/20";
  if (norm === "DOWN") return "bg-red-500/10 border-red-500/20";
  return "bg-white/5 border-white/10";
}

export default function PredictionScorecard({ predictions, livePredictions }: Props) {
  // Merge: prefer live predictions, fall back to DB
  const allPredictions = livePredictions && livePredictions.length > 0 ? livePredictions : predictions;

  const upCalls = allPredictions.filter((p) => normalizeDirection(p.direction) === "UP");
  const downCalls = allPredictions.filter((p) => normalizeDirection(p.direction) === "DOWN");
  const neutralCalls = allPredictions.filter((p) => normalizeDirection(p.direction) === "NEUTRAL");

  const graded = predictions.filter((p) => p.status === "graded");
  const accurate = graded.filter((p) => (p.accuracy ?? 1) < 0.05);

  const avgConfidence = allPredictions.length > 0
    ? allPredictions.reduce((sum, p) => sum + p.confidence, 0) / allPredictions.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Total</div>
          <div className="text-xl font-bold text-white">{allPredictions.length}</div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Avg Confidence</div>
          <div className="text-xl font-bold text-amber-400">
            {avgConfidence > 0 ? `${(avgConfidence * 100).toFixed(0)}%` : "\u2014"}
          </div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Bullish</div>
          <div className="text-xl font-bold text-green-400">{upCalls.length}</div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Bearish</div>
          <div className="text-xl font-bold text-red-400">{downCalls.length}</div>
        </div>
        <div className="crypto-card text-center">
          <div className="text-[10px] text-white/30 uppercase">Accuracy</div>
          <div className="text-xl font-bold text-amber-400">
            {graded.length > 0 ? `${((accurate.length / graded.length) * 100).toFixed(0)}%` : "Pending"}
          </div>
        </div>
      </div>

      {/* Predictions grid */}
      <div className="crypto-card">
        <h3 className="text-xs text-white/40 uppercase tracking-wider mb-4">AI Predictions (24h Outlook)</h3>
        {allPredictions.length === 0 ? (
          <p className="text-sm text-white/20 text-center py-6">Predictions generate every 4 hours</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allPredictions.map((p, i) => {
              const symbol = p.asset || p.symbol || "";
              const ticker = symbol.replace("_USDT", "");
              const target = p.targetPrice ?? p.target_price ?? 0;
              const current = p.currentPrice ?? p.current_price ?? 0;
              const diff = current > 0 ? ((target - current) / current) * 100 : 0;
              const dir = normalizeDirection(p.direction);

              return (
                <div
                  key={p.id || `${symbol}-${i}`}
                  className={`border rounded-lg p-3 ${dirBg(p.direction)} transition-colors`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${dirColor(p.direction)}`}>
                        {dir === "UP" ? "\u25B2" : dir === "DOWN" ? "\u25BC" : "\u25C6"} {dir}
                      </span>
                      <span className="text-sm font-semibold text-white">{ticker}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-400/80 font-medium">
                        {(p.confidence * 100).toFixed(0)}%
                      </span>
                      {p.status === "graded" && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                            (p.accuracy ?? 1) < 0.05
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {(p.accuracy ?? 1) < 0.05 ? "HIT" : "MISS"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">
                      Now: {current > 0 ? `$${current.toLocaleString()}` : "\u2014"}
                    </span>
                    <span className="text-white/40">
                      Target: <span className="text-white/70">${target.toLocaleString()}</span>
                      {diff !== 0 && (
                        <span className={`ml-1 ${diff >= 0 ? "text-green-400/60" : "text-red-400/60"}`}>
                          ({diff >= 0 ? "+" : ""}{diff.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  {p.rationale && (
                    <p className="text-[10px] text-white/25 mt-2 leading-relaxed line-clamp-2">{p.rationale}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
