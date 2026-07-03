"use client";

import { useState } from "react";

type RunState = "idle" | "queueing" | "queued" | "error";

const TICKER_FOR_REGIME: Record<string, string> = {
  TRENDING_UP: "NVDA",
  TRENDING_DOWN: "JPM",
  RANGE_BOUND: "AAPL",
  HIGH_VOLATILITY: "TSLA",
  CRASH: "UNH",
  UNKNOWN: "AAPL",
};

export default function ResearchThisButton({
  assetClass,
  regime,
}: {
  assetClass: string;
  regime?: string;
}) {
  const [state, setState] = useState<RunState>("idle");
  const [msg, setMsg] = useState<string>("");

  // Only meaningful for stock engines (TradingAgents universe is tier1 stocks)
  if (!assetClass.startsWith("stocks")) return null;

  const ticker = TICKER_FOR_REGIME[regime || "UNKNOWN"] ?? "AAPL";

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state === "queueing" || state === "queued") return;
    setState("queueing");
    setMsg("");
    try {
      const res = await fetch("/api/trading/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt.slice(0, 120)}`);
      }
      const data = await res.json();
      setState("queued");
      setMsg(
        `Queued ${ticker} · job ${(data.job_id || "?").slice(0, 8)} · verdict in ~30-60min`,
      );
      setTimeout(() => {
        setState("idle");
        setMsg("");
      }, 8000);
    } catch (err: any) {
      setState("error");
      setMsg(err?.message || "request failed");
      setTimeout(() => {
        setState("idle");
        setMsg("");
      }, 6000);
    }
  }

  const label =
    state === "queueing"
      ? "Queueing…"
      : state === "queued"
      ? `Queued ${ticker}`
      : state === "error"
      ? "Retry"
      : `Research ${ticker}`;

  const cls =
    state === "queued"
      ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
      : state === "error"
      ? "border-rose-500/40 text-rose-300 bg-rose-500/10"
      : "border-amber-500/30 text-amber-300/90 bg-amber-500/5 hover:bg-amber-500/10";

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        disabled={state === "queueing" || state === "queued"}
        className={`w-full px-2 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${cls}`}
        title={`Trigger TradingAgents (Tauric multi-agent debate) on ${ticker}. Runs on local Qwen3.6, ~30-60min.`}
      >
        {label}
      </button>
      {msg && (
        <div className="mt-1 text-[10px] text-white/40 leading-tight">{msg}</div>
      )}
    </div>
  );
}
