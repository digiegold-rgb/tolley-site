"use client";

import { useEffect, useState } from "react";

type Decision = {
  id: string;
  ticker: string;
  runDate: string;
  decision: string;
  rawDecision: string | null;
  elapsedSeconds: number | null;
  fundamentalsReport: string | null;
  sentimentReport: string | null;
  newsReport: string | null;
  marketReport: string | null;
  bullHistory: string | null;
  bearHistory: string | null;
  investmentPlan: string | null;
  traderPlan: string | null;
  riskJudgeDecision: string | null;
  finalTradeDecision: string | null;
  realizedReturn: number | null;
  alphaVsSpy: number | null;
  modelUsed: string | null;
  createdAt: string;
};

const DECISION_STYLE: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  SELL: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  HOLD: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const TIER1 = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "JPM", "V", "UNH"];

function ReportSection({ title, body }: { title: string; body: string | null }) {
  const [open, setOpen] = useState(false);
  if (!body) return null;
  return (
    <div className="border-t border-white/5 pt-3 mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left text-xs uppercase tracking-wider text-white/50 hover:text-white/80"
      >
        <span>{title}</span>
        <span className="text-white/30">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/70 font-mono max-h-[400px] overflow-auto">
          {body}
        </pre>
      )}
    </div>
  );
}

function DecisionCard({ d }: { d: Decision }) {
  const cls = DECISION_STYLE[d.decision] ?? DECISION_STYLE.HOLD;
  return (
    <div className="crypto-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-white">{d.ticker}</div>
          <div className="text-[11px] text-white/30">
            {d.runDate} · model {d.modelUsed ?? "—"}
            {d.elapsedSeconds ? ` · ${Math.round(d.elapsedSeconds)}s` : ""}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cls}`}>
          {d.decision}
        </span>
      </div>

      {d.alphaVsSpy != null && (
        <div className="mt-2 text-xs">
          <span className="text-white/40">Realized α vs SPY: </span>
          <span className={d.alphaVsSpy >= 0 ? "text-emerald-400" : "text-rose-400"}>
            {(d.alphaVsSpy * 100).toFixed(2)}%
          </span>
        </div>
      )}

      <ReportSection title="Final trade decision" body={d.finalTradeDecision} />
      <ReportSection title="Risk team judgement" body={d.riskJudgeDecision} />
      <ReportSection title="Trader plan" body={d.traderPlan} />
      <ReportSection title="Investment plan (research mgr)" body={d.investmentPlan} />
      <ReportSection title="Bull case" body={d.bullHistory} />
      <ReportSection title="Bear case" body={d.bearHistory} />
      <ReportSection title="Fundamentals" body={d.fundamentalsReport} />
      <ReportSection title="News" body={d.newsReport} />
      <ReportSection title="Sentiment" body={d.sentimentReport} />
      <ReportSection title="Technical" body={d.marketReport} />
    </div>
  );
}

export default function AiResearchPanel() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [tickerInput, setTickerInput] = useState("");
  const [filter, setFilter] = useState<string>("all");

  async function loadDecisions() {
    try {
      const r = await fetch("/api/trading/agents/decisions?limit=100", { cache: "no-store" });
      if (r.ok) {
        const { decisions } = await r.json();
        setDecisions(decisions);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus() {
    try {
      const r = await fetch("/api/trading/agents/run", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setServiceOnline(Boolean(data.online));
      } else {
        setServiceOnline(false);
      }
    } catch {
      setServiceOnline(false);
    }
  }

  useEffect(() => {
    loadDecisions();
    loadStatus();
    const t = setInterval(() => {
      loadDecisions();
      loadStatus();
    }, 30000);
    return () => clearInterval(t);
  }, []);

  async function runTicker(ticker: string) {
    setRunning((r) => ({ ...r, [ticker]: true }));
    try {
      const res = await fetch("/api/trading/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`Failed to queue ${ticker}: ${txt}`);
      }
    } finally {
      setRunning((r) => ({ ...r, [ticker]: false }));
    }
  }

  const filtered = decisions.filter((d) => filter === "all" || d.decision === filter);
  const counts = decisions.reduce<Record<string, number>>(
    (acc, d) => ((acc[d.decision] = (acc[d.decision] ?? 0) + 1), acc),
    {},
  );

  return (
    <div className="space-y-4">
      <div className="crypto-card crypto-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-white/30 uppercase tracking-wider">
              TradingAgents · Multi-Agent LLM Research
            </div>
            <div className="text-sm text-white/60 mt-1">
              Daily debate-driven analysis (4 analysts → bull/bear → trader → risk team).
              Runs at 4pm CT after market close.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                serviceOnline
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : serviceOnline === false
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"
              }`}
            >
              {serviceOnline === null ? "…" : serviceOnline ? "Service online" : "Offline"}
            </span>
            <span className="text-[11px] text-white/40">
              {decisions.length} decisions · BUY {counts.BUY ?? 0} · HOLD {counts.HOLD ?? 0} · SELL {counts.SELL ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="crypto-card">
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Run analysis</div>
        <div className="flex flex-wrap items-center gap-2">
          {TIER1.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => runTicker(t)}
              disabled={running[t]}
              className="px-2.5 py-1 rounded-md text-xs bg-white/5 hover:bg-amber-400/20 border border-white/10 hover:border-amber-400/40 text-white/80 disabled:opacity-50"
            >
              {running[t] ? `${t}…` : t}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              placeholder="custom ticker"
              className="px-2 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-white/80 placeholder-white/20 w-32"
            />
            <button
              type="button"
              onClick={() => tickerInput && runTicker(tickerInput)}
              disabled={!tickerInput}
              className="px-2.5 py-1 rounded-md text-xs bg-amber-400/20 hover:bg-amber-400/40 border border-amber-400/40 text-amber-200 disabled:opacity-30"
            >
              Run
            </button>
          </div>
        </div>
        <div className="text-[11px] text-white/30 mt-2">
          Each run takes 5–15 min on local Qwen3.6. Refreshes auto every 30s.
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {(["all", "BUY", "HOLD", "SELL"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-md border ${
              filter === f
                ? "bg-amber-400/20 border-amber-400/40 text-amber-200"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white/80"
            }`}
          >
            {f === "all" ? `All (${decisions.length})` : `${f} (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Loading decisions…</div>
      ) : filtered.length === 0 ? (
        <div className="crypto-card text-center py-10 text-white/40">
          No decisions yet. Click a ticker above to run the first analysis.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((d) => (
            <DecisionCard key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}
