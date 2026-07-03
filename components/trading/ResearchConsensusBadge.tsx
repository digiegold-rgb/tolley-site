"use client";

import type { ResearchVerdict } from "@/lib/trading/aiResearch";
import { summarizeConsensus } from "@/lib/trading/aiResearch";

const DOMINANT_STYLE: Record<string, string> = {
  BUY: "border-emerald-500/30 text-emerald-300 bg-emerald-500/5",
  SELL: "border-rose-500/30 text-rose-300 bg-rose-500/5",
  HOLD: "border-zinc-500/30 text-zinc-300 bg-zinc-500/5",
  MIXED: "border-amber-500/30 text-amber-300 bg-amber-500/5",
};

export default function ResearchConsensusBadge({
  verdicts,
}: {
  verdicts: ResearchVerdict[];
}) {
  const c = summarizeConsensus(verdicts);
  if (c.total === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 text-[10px] text-white/40">
        <span className="text-amber-400/60">AI</span>
        <span>no verdicts yet</span>
      </div>
    );
  }
  const cls = DOMINANT_STYLE[c.dominant] ?? DOMINANT_STYLE.MIXED;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] ${cls}`}
      title={`AI Research consensus across ${c.total} tier1 tickers (${c.freshTickers} fresh)`}
    >
      <span className="text-amber-400/80 font-semibold">AI</span>
      <span className="font-bold">{c.dominant}</span>
      <span className="text-white/40">·</span>
      <span className="text-emerald-300/80">B {c.buy}</span>
      <span className="text-zinc-300/70">H {c.hold}</span>
      <span className="text-rose-300/80">S {c.sell}</span>
    </div>
  );
}
