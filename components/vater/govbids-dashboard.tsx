"use client";

import { useState } from "react";
import { DEMO_GOVBIDS, getDemoGovBidStats, getDaysUntil, formatCurrency, type DemoGovBid } from "@/lib/vater/demo-data";

const TABS = ["all", "open", "bid-submitted", "under-review", "won", "lost"] as const;
type Tab = (typeof TABS)[number];

const agencyColor: Record<string, string> = {
  DoD: "dod",
  GSA: "gsa",
  VA: "va",
  DHS: "dhs",
  USDA: "usda",
};

export function GovBidsDashboard() {
  const [bids, setBids] = useState<DemoGovBid[]>(DEMO_GOVBIDS);
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const stats = getDemoGovBidStats(bids);

  const filtered = tab === "all" ? bids : bids.filter((b) => b.status === tab);

  const counts = bids.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const generateBid = (id: string) => {
    setGenerating(id);
    setTimeout(() => {
      setBids((prev) => prev.map((b) => b.id === id ? { ...b, status: "bid-submitted" as const } : b));
      setGenerating(null);
      setExpanded(null);
    }, 2000);
  };

  const markWon = (id: string) => {
    setBids((prev) => prev.map((b) => b.id === id ? { ...b, status: "won" as const } : b));
    setExpanded(null);
  };

  const markLost = (id: string) => {
    setBids((prev) => prev.map((b) => b.id === id ? { ...b, status: "lost" as const } : b));
    setExpanded(null);
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="vater-section-title mb-3">GovBids Dashboard</h2>
      <p className="vater-section-subtitle mb-8">
        Government contract pipeline — scan, bid, win.
        <span className="ml-2 text-xs text-sky-400/60">(Demo Data)</span>
      </p>

      {/* Stats Bar */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="vater-stat-card">
          <div className="vater-stat-value">{stats.winRate}%</div>
          <div className="vater-stat-label">Win Rate</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">{stats.totalBids}</div>
          <div className="vater-stat-label">Total Bids</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">{formatCurrency(stats.pipelineValue)}</div>
          <div className="vater-stat-label">Pipeline Value</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">{formatCurrency(stats.revenueWon)}</div>
          <div className="vater-stat-label">Revenue Won</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((s) => {
          const count = s === "all" ? bids.length : counts[s] || 0;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-all ${
                tab === s
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500"
              }`}
            >
              {s.replace(/-/g, " ")} ({count})
            </button>
          );
        })}
      </div>

      {/* Bid Cards */}
      <div className="space-y-4">
        {filtered.map((bid) => {
          const days = getDaysUntil(bid.deadline);
          const urgency = days > 14 ? "text-green-400" : days > 7 ? "text-amber-400" : "text-red-400";
          const urgencyBg = days > 14 ? "bg-green-500/10 border-green-500/20" : days > 7 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

          return (
            <div
              key={bid.id}
              className="vater-card cursor-pointer p-5 transition-all"
              onClick={() => setExpanded(expanded === bid.id ? null : bid.id)}
            >
              <div className="flex flex-wrap items-start gap-3">
                {/* Agency badge */}
                <span className={`vater-badge vater-badge-${agencyColor[bid.agency]}`}>
                  {bid.agency}
                </span>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <code className="text-xs text-slate-500 font-mono">{bid.solicitationNumber}</code>
                    <span className={`vater-badge vater-badge-${bid.status}`}>
                      {bid.status.replace(/-/g, " ")}
                    </span>
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-200 leading-tight">
                    {bid.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Est. Value: <span className="text-sky-400 font-semibold">{formatCurrency(bid.estimatedValue)}</span></span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">
                      NAICS {bid.naicsCode}
                    </span>
                    <span>Margin: <span className="text-green-400">{bid.marginPercent}%</span></span>
                    {bid.setAside && (
                      <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                        {bid.setAside}
                      </span>
                    )}
                  </div>
                </div>

                {/* Deadline countdown */}
                {(bid.status === "open" || bid.status === "bid-submitted") && (
                  <div className={`rounded-lg border px-3 py-2 text-center ${urgencyBg}`}>
                    <div className={`text-lg font-bold ${urgency}`}>{days}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">days left</div>
                  </div>
                )}
              </div>

              {/* Expanded */}
              {expanded === bid.id && (
                <div className="mt-4 border-t border-slate-700/50 pt-4">
                  <p className="mb-4 text-sm text-slate-400 leading-relaxed">
                    {bid.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bid.status === "open" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); generateBid(bid.id); }}
                        disabled={generating === bid.id}
                        className="vater-cta text-xs disabled:opacity-50"
                      >
                        {generating === bid.id ? "Generating..." : "Generate Bid Package"}
                      </button>
                    )}
                    {bid.status === "under-review" && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); markWon(bid.id); }}
                          className="vater-cta text-xs"
                        >
                          Mark Won
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); markLost(bid.id); }}
                          className="rounded-lg border border-red-500/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
                        >
                          Mark Lost
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
