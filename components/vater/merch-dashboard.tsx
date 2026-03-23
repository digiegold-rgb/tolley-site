"use client";

import { useState } from "react";
import Link from "next/link";
import { DEMO_MERCH_DESIGNS, getDemoMerchStats, type DemoMerchDesign } from "@/lib/vater/demo-data";

const TABS = ["all", "trending", "design-ready", "listed", "sold"] as const;
type Tab = (typeof TABS)[number];

const SORT_OPTIONS = ["newest", "trend-score", "profit", "sales"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

export function MerchDashboard() {
  const [designs, setDesigns] = useState<DemoMerchDesign[]>(DEMO_MERCH_DESIGNS);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const stats = getDemoMerchStats(designs);

  const filtered = tab === "all" ? designs : designs.filter((d) => d.status === tab);

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "trend-score": return b.trendScore - a.trendScore;
      case "profit": return b.profit - a.profit;
      case "sales": return b.sales - a.sales;
      default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const counts = designs.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const listOnEtsy = (id: string) => {
    setDesigns((prev) => prev.map((d) => d.id === id ? { ...d, status: "listed" as const } : d));
    setExpanded(null);
  };

  const markSold = (id: string) => {
    setDesigns((prev) => prev.map((d) => d.id === id ? { ...d, status: "sold" as const, sales: d.sales + 1 } : d));
    setExpanded(null);
  };

  const generateSimilar = (id: string) => {
    setGenerating(true);
    const source = designs.find((d) => d.id === id);
    if (!source) return;
    setTimeout(() => {
      const newItems: DemoMerchDesign[] = [1, 2, 3].map((n) => ({
        id: `demo-merch-gen-${Date.now()}-${n}`,
        title: `${source.title} v${n + 1}`,
        productType: source.productType,
        trendSource: source.trendSource,
        trendScore: Math.max(50, source.trendScore - 5 + n * 3),
        price: source.price,
        cost: source.cost,
        profit: source.profit,
        sales: 0,
        status: "design-ready" as const,
        imageUrl: source.imageUrl,
        createdAt: new Date().toISOString(),
      }));
      setDesigns((prev) => [...newItems, ...prev]);
      setGenerating(false);
    }, 1500);
  };

  const productTypeLabel: Record<string, string> = {
    "t-shirt": "T-Shirt",
    hoodie: "Hoodie",
    mug: "Mug",
    sticker: "Sticker",
    poster: "Poster",
    "phone-case": "Phone Case",
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="vater-section-title mb-3">Merch Dashboard</h2>
      <p className="vater-section-subtitle mb-8">
        AI-generated designs — trending, listed, and sold.
        <span className="ml-2 text-xs text-sky-400/60">(Demo Data)</span>
      </p>

      {/* Stats Bar */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="vater-stat-card">
          <div className="vater-stat-value">{stats.totalDesigns}</div>
          <div className="vater-stat-label">Total Designs</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">{stats.activeListings}</div>
          <div className="vater-stat-label">Active Listings</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">${stats.revenue.toLocaleString()}</div>
          <div className="vater-stat-label">Revenue</div>
        </div>
        <div className="vater-stat-card">
          <div className="vater-stat-value">${stats.avgProfit.toFixed(2)}</div>
          <div className="vater-stat-label">Avg Profit/Item</div>
        </div>
      </div>

      {/* Trend Intelligence Link */}
      <Link
        href="/shop/dashboard/trends"
        className="vater-card mb-6 flex items-center gap-4 p-4 transition-all hover:border-amber-500/30 group"
      >
        <span className="text-xl">🔍</span>
        <div className="flex-1">
          <span className="text-sm font-semibold text-slate-200 group-hover:text-amber-400 transition">
            Trend Intelligence
          </span>
          <span className="ml-2 text-xs text-slate-400">
            Find what&apos;s trending to design next — 60+ sources, AI-ranked
          </span>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Open →</span>
      </Link>

      {/* Filter Tabs + Sort */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TABS.map((s) => {
          const count = s === "all" ? designs.length : counts[s] || 0;
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
              {s.replace("-", " ")} ({count})
            </button>
          );
        })}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="ml-auto rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold uppercase text-slate-400"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o} value={o}>{o.replace("-", " ")}</option>
          ))}
        </select>
      </div>

      {generating && (
        <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-center text-sm text-sky-400">
          Generating similar designs...
        </div>
      )}

      {/* Gallery Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((d) => (
          <div
            key={d.id}
            className="vater-card cursor-pointer p-4 transition-all"
            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
          >
            {/* Image */}
            <div className="relative mb-3 aspect-square overflow-hidden rounded-lg border border-slate-700/50">
              <img src={d.imageUrl} alt={d.title} className="h-full w-full object-cover" />
              <span className={`vater-badge vater-badge-${d.status} absolute right-2 top-2`}>
                {d.status.replace("-", " ")}
              </span>
            </div>

            {/* Product type + trend source */}
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                {productTypeLabel[d.productType]}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-400">
                {d.trendSource}
              </span>
            </div>

            {/* Trend score bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Trend Score</span>
                <span className="font-semibold text-sky-400">{d.trendScore}</span>
              </div>
              <div className="vater-progress mt-0.5">
                <div className="vater-progress-fill" style={{ width: `${d.trendScore}%` }} />
              </div>
            </div>

            {/* Title + numbers */}
            <h3 className="mb-1 text-sm font-semibold text-slate-200 leading-tight">{d.title}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="text-green-400 font-semibold">${d.price}</span>
              <span>Profit: <span className="text-green-400">${d.profit.toFixed(2)}</span></span>
              {d.sales > 0 && <span>{d.sales} sold</span>}
            </div>

            {/* Expanded details */}
            {expanded === d.id && (
              <div className="mt-4 border-t border-slate-700/50 pt-4">
                <div className="mb-3 space-y-1 text-xs text-slate-400">
                  <div>Cost: ${d.cost.toFixed(2)} | Margin: {((d.profit / d.price) * 100).toFixed(0)}%</div>
                  <div>Created: {new Date(d.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(d.status === "trending" || d.status === "design-ready") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); listOnEtsy(d.id); }}
                      className="vater-cta text-xs"
                    >
                      List on Etsy
                    </button>
                  )}
                  {d.status === "listed" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markSold(d.id); }}
                      className="vater-cta text-xs"
                    >
                      Mark Sold
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); generateSimilar(d.id); }}
                    disabled={generating}
                    className="rounded-lg border border-sky-500/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/10 disabled:opacity-50"
                  >
                    Generate Similar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
