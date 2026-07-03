"use client";

import Link from "next/link";
import type { ResearchVerdict } from "@/lib/trading/aiResearch";
import { TIER1_TICKERS } from "@/lib/trading/aiResearch";

const DECISION_STYLE: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  SELL: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  HOLD: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

function ageLabel(daysOld: number): string {
  if (daysOld === 0) return "today";
  if (daysOld === 1) return "1d";
  if (daysOld < 7) return `${daysOld}d`;
  if (daysOld < 30) return `${Math.floor(daysOld / 7)}w`;
  return `${Math.floor(daysOld / 30)}mo`;
}

export default function ResearchVerdictStrip({
  verdicts,
}: {
  verdicts: ResearchVerdict[];
}) {
  const byTicker = new Map(verdicts.map((v) => [v.ticker, v]));
  const fresh = verdicts.filter((v) => v.daysOld <= 3).length;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-amber-400/80">
            AI Research · TradingAgents
          </span>
          <span className="text-[11px] text-white/30">
            {verdicts.length}/{TIER1_TICKERS.length} tier1 · {fresh} fresh
          </span>
        </div>
        <Link
          href="/trading/ai-research"
          className="text-[11px] text-amber-400/70 hover:text-amber-300 transition-colors"
        >
          full reports →
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TIER1_TICKERS.map((ticker) => {
          const v = byTicker.get(ticker);
          if (!v) {
            return (
              <div
                key={ticker}
                className="shrink-0 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] text-[11px] text-white/30"
                title={`${ticker} — no run yet`}
              >
                <div className="font-mono font-semibold text-white/40">{ticker}</div>
                <div className="text-[10px]">—</div>
              </div>
            );
          }
          const cls = DECISION_STYLE[v.decision] ?? DECISION_STYLE.HOLD;
          const stale = v.daysOld > 3;
          return (
            <Link
              key={ticker}
              href={`/trading/ai-research?ticker=${ticker}`}
              className={`shrink-0 px-3 py-2 rounded-lg border ${cls} ${
                stale ? "opacity-60" : ""
              } hover:scale-[1.02] transition-transform`}
              title={
                v.rawDecision
                  ? `${ticker} → ${v.decision} (raw: ${v.rawDecision}) · run ${v.runDate}`
                  : `${ticker} → ${v.decision} · run ${v.runDate}`
              }
            >
              <div className="font-mono font-semibold tracking-tight">{ticker}</div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="font-bold">{v.decision}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/50">{ageLabel(v.daysOld)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
