"use client";

import { useState, useEffect } from "react";
import { ProfitCalculator } from "@/components/shop/ProfitCalculator";

interface ArbitragePair {
  id: string;
  ebayTitle: string;
  ebayPrice: number;
  ebayUrl: string | null;
  ebayImageUrl: string | null;
  amazonTitle: string;
  amazonPrice: number;
  amazonUrl: string | null;
  profit: number;
  marginPercent: number;
  roi: number;
  status: string;
  category: string | null;
  notes: string | null;
  createdAt: string;
}

export default function ArbitragePage() {
  const [pairs, setPairs] = useState<ArbitragePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    loadPairs();
  }, [filter]);

  async function loadPairs() {
    setLoading(true);
    try {
      // ArbitragePair is accessed via prisma directly — we'll use the scan endpoint info
      const res = await fetch(`/api/shop/products?status=all&limit=0`);
      if (res.ok) {
        // For now, show placeholder — arbitrage pairs come from the scanner
      }
    } catch {
      // silent
    }
    setLoading(false);
  }

  async function sourceProduct(pair: ArbitragePair) {
    try {
      const res = await fetch("/api/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pair.ebayTitle,
          category: pair.category || undefined,
          costBasis: pair.amazonPrice,
          targetPrice: pair.ebayPrice,
          sourcingType: "online_arbitrage",
          sourcingVendor: pair.amazonTitle.split(":")[0],
          imageUrls: pair.ebayImageUrl ? [pair.ebayImageUrl] : [],
          status: "draft",
        }),
      });

      if (res.ok) {
        alert("Product draft created from arbitrage pair!");
      }
    } catch {
      alert("Failed to create product");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Arbitrage</h1>
      <p className="mt-1 text-sm text-white/40">
        Discovered pairs from nightly scans. Source profitable items with one click.
      </p>

      {/* Filters */}
      <div className="mt-4 flex gap-2">
        {["pending", "approved", "rejected", "listed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition capitalize ${
              filter === s
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-white/40 border border-white/10 hover:bg-white/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Pairs list */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="py-8 text-center text-white/30 text-sm">Loading pairs...</p>
        ) : pairs.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-2xl">💰</p>
            <p className="mt-2 text-sm text-white/40">
              No arbitrage pairs found. The scanner runs nightly at 2 AM to discover profitable opportunities.
            </p>
          </div>
        ) : (
          pairs.map((pair) => (
            <div
              key={pair.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{pair.ebayTitle}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="text-blue-400">eBay: ${pair.ebayPrice.toFixed(2)}</span>
                    <span className="text-white/20">→</span>
                    <span className="text-orange-400">Source: ${pair.amazonPrice.toFixed(2)}</span>
                  </div>
                  {pair.notes && (
                    <p className="mt-1 text-[0.65rem] text-white/25 line-clamp-1">{pair.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-green-400">${pair.profit.toFixed(2)}</p>
                  <p className="text-xs text-white/30">{pair.roi.toFixed(0)}% ROI</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => sourceProduct(pair)}
                  className="shop-btn-primary rounded-lg px-3 py-1.5 text-xs"
                >
                  Source This
                </button>
                {pair.ebayUrl && (
                  <a
                    href={pair.ebayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/40 hover:text-white/60"
                  >
                    View on eBay
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Profit Calculator */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white/60">Profit Calculator</h2>
        <ProfitCalculator />
      </div>
    </div>
  );
}
