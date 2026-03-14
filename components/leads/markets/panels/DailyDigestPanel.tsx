"use client";

import { useDigest } from "../hooks/useMarketData";

export default function DailyDigestPanel() {
  const { data, loading } = useDigest();
  const digest = data?.digest;

  if (loading || !digest) return null;

  return (
    <div className="rounded-lg bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-cyan-500/10 border border-cyan-500/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-cyan-300/60 uppercase tracking-wider mb-1">Daily Digest</div>
          <p className="text-sm font-medium text-white">{digest.headline}</p>
        </div>
        <span className="text-[10px] text-white/20 shrink-0">
          {new Date(digest.date).toLocaleDateString()}
        </span>
      </div>

      {/* Key changes as compact pills */}
      {digest.keyChanges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {digest.keyChanges.map((kc, i) => {
            const isUp = kc.direction === "up";
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                  isUp
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {kc.metric}
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                  <path
                    d={isUp ? "M5 2L8 6H2L5 2Z" : "M5 8L2 4H8L5 8Z"}
                    fill="currentColor"
                  />
                </svg>
                {typeof kc.to === "number" ? kc.to.toFixed(1) : kc.to}
              </span>
            );
          })}
        </div>
      )}

      {/* Risk factors + opportunities in columns */}
      {(digest.riskFactors.length > 0 || digest.opportunities.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {digest.riskFactors.length > 0 && (
            <div>
              <div className="text-[10px] text-red-400/60 uppercase mb-1">Risks</div>
              {digest.riskFactors.slice(0, 3).map((rf, i) => (
                <p key={i} className="text-[10px] text-white/40 mb-0.5">
                  <span className="text-red-400/80">{rf.severity === "high" ? "!!" : "!"}</span> {rf.factor}
                </p>
              ))}
            </div>
          )}
          {digest.opportunities.length > 0 && (
            <div>
              <div className="text-[10px] text-green-400/60 uppercase mb-1">Opportunities</div>
              {digest.opportunities.slice(0, 3).map((op, i) => (
                <p key={i} className="text-[10px] text-white/40 mb-0.5">
                  <span className="text-green-400/80">{Math.round(op.confidence * 100)}%</span> {op.opportunity}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
