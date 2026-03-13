"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

interface ArbitragePair {
  id: string;
  ebayTitle: string;
  ebayPrice: number;
  ebayUrl: string | null;
  ebayImageUrl: string | null;
  ebayItemId: string | null;
  amazonTitle: string;
  amazonPrice: number;
  amazonUrl: string | null;
  amazonImageUrl: string | null;
  amazonAsin: string | null;
  ebayFees: number;
  profit: number;
  marginPercent: number;
  roi: number;
  status: string;
  source: string;
  submittedBy: string | null;
  category: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_TABS = ["all", "pending", "approved", "rejected", "listed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export function DropshipArbitrage() {
  const [pairs, setPairs] = useState<ArbitragePair[]>([]);
  const [tab, setTab] = useState<StatusTab>("all");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchPairs = useCallback(async () => {
    try {
      const res = await fetch("/api/vater/arbitrage");
      if (!res.ok) return;
      const data = await res.json();
      setPairs(data.pairs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  const transition = async (id: string, status: string) => {
    setActing(id);
    // Optimistic update
    setPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
    try {
      const res = await fetch(`/api/vater/arbitrage/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        // Revert on failure
        await fetchPairs();
      }
    } catch {
      await fetchPairs();
    } finally {
      setActing(null);
    }
  };

  const filtered = tab === "all" ? pairs : pairs.filter((p) => p.status === tab);

  const counts = pairs.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="vater-section-title mb-3">Arbitrage Queue</h2>
      <p className="vater-section-subtitle mb-8">
        Review price-gap pairs. Approve to list, reject to skip.
      </p>

      {/* Filter Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => {
          const count =
            s === "all" ? pairs.length : counts[s] || 0;
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
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="vater-card p-12 text-center text-slate-400">
          Loading pairs...
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="vater-card p-12 text-center text-slate-500">
          No {tab === "all" ? "" : tab} pairs found. Seed some via{" "}
          <code className="text-sky-400">POST /api/vater/arbitrage/seed</code>
        </div>
      )}

      {/* Pair Cards */}
      <div className="space-y-6">
        {filtered.map((pair) => (
          <div key={pair.id} className="vater-card relative p-6">
            {/* Status Badge */}
            <span
              className={`vater-badge vater-badge-${pair.status} absolute right-4 top-4`}
            >
              {pair.status}
            </span>

            {/* Category + Source */}
            <div className="mb-4 flex items-center gap-3 text-xs text-slate-500">
              {pair.category && (
                <span className="rounded bg-slate-800 px-2 py-0.5">
                  {pair.category}
                </span>
              )}
              <span>via {pair.source}</span>
              {pair.submittedBy && <span>by {pair.submittedBy}</span>}
            </div>

            {/* Product Grid: eBay | Amazon */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* eBay Side */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                  eBay — Sell
                </div>
                {pair.ebayImageUrl && (
                  <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg border border-slate-700/50">
                    <Image
                      src={pair.ebayImageUrl}
                      alt={pair.ebayTitle}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <p className="mb-2 text-sm font-medium text-slate-200">
                  {pair.ebayTitle}
                </p>
                <div className="vater-price-bar vater-price-ebay">
                  ${pair.ebayPrice.toFixed(2)}
                </div>
              </div>

              {/* Amazon Side */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#ff9900]">
                  Amazon — Buy
                </div>
                {pair.amazonImageUrl && (
                  <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg border border-slate-700/50">
                    <Image
                      src={pair.amazonImageUrl}
                      alt={pair.amazonTitle}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <p className="mb-2 text-sm font-medium text-slate-200">
                  {pair.amazonTitle}
                </p>
                <div className="vater-price-bar vater-price-amazon">
                  ${pair.amazonPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Profit Bar */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-green-400">
                  Net Profit ({pair.marginPercent}% margin)
                </span>
                <span className="text-xs text-slate-500">
                  Fees: ${pair.ebayFees.toFixed(2)} | ROI: {pair.roi}%
                </span>
              </div>
              <div className="vater-price-bar vater-price-profit font-bold">
                ${pair.profit.toFixed(2)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex gap-3">
              {pair.status === "pending" && (
                <>
                  <button
                    onClick={() => transition(pair.id, "approved")}
                    disabled={acting === pair.id}
                    className="vater-cta text-sm disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => transition(pair.id, "rejected")}
                    disabled={acting === pair.id}
                    className="rounded-lg border border-red-500/40 bg-transparent px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {pair.status === "approved" && (
                <button
                  onClick={() => transition(pair.id, "listed")}
                  disabled={acting === pair.id}
                  className="vater-cta text-sm disabled:opacity-50"
                >
                  Mark Listed
                </button>
              )}
              {pair.status === "rejected" && (
                <button
                  onClick={() => transition(pair.id, "pending")}
                  disabled={acting === pair.id}
                  className="rounded-lg border border-slate-600 bg-transparent px-4 py-2 text-sm font-semibold text-slate-400 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Reconsider
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
