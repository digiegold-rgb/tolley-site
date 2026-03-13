"use client";

import type { RevenueSplitResult } from "@/lib/wd";

interface Props {
  clientName: string;
  unitCost: number;
  split: RevenueSplitResult;
}

export function KeaganRoiBar({ clientName, unitCost, split }: Props) {
  const paidBack = unitCost - split.paybackRemaining;
  const pct = unitCost > 0 ? Math.min(100, Math.round((paidBack / unitCost) * 100)) : 100;
  const isComplete = split.paybackComplete;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-900">{clientName}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          isComplete
            ? "bg-green-100 text-green-700"
            : "bg-blue-100 text-blue-700"
        }`}>
          {isComplete ? "Post-payback: 60/40" : `${pct}% recovered`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: isComplete
              ? "linear-gradient(90deg, #22c55e, #16a34a)"
              : "linear-gradient(90deg, #3b82f6, #2563eb)",
          }}
        />
        {/* Animated shine */}
        {!isComplete && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-30"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
              animation: "shimmer 2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Investment: <span className="font-semibold text-gray-700">${unitCost}</span></span>
        <span>Paid back: <span className="font-semibold text-gray-700">${paidBack.toFixed(0)}</span></span>
        {isComplete ? (
          <span className="text-green-600 font-semibold flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            60% Keagan / 40% Tolley
          </span>
        ) : (
          <span className="text-blue-600 font-semibold">
            ${split.paybackRemaining.toFixed(0)} remaining
          </span>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
