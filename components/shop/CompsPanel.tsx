"use client";

import { useState } from "react";

interface CompItem {
  id: string;
  title: string | null;
  price: number;
  platform: string;
  url: string | null;
  soldDate: string | null;
  condition: string | null;
}

interface CompsResult {
  query: string;
  compsCount: number;
  avgPrice: number;
  medianPrice: number;
  lowPrice: number;
  highPrice: number;
  comps: CompItem[];
}

export function CompsPanel({ productId, title }: { productId?: string; title?: string }) {
  const [query, setQuery] = useState(title || "");
  const [result, setResult] = useState<CompsResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchComps() {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch("/api/shop/comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, productId }),
      });
      if (res.ok) {
        setResult(await res.json());
      } else {
        alert("Failed to fetch comps");
      }
    } catch {
      alert("Comps lookup failed");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white/60">Comparable Sales</h3>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search eBay sold listings..."
          className="shop-input flex-1 rounded-lg px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && fetchComps()}
        />
        <button
          onClick={fetchComps}
          disabled={loading || !query}
          className="shop-btn-primary rounded-lg px-4 py-2 text-sm"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {result && (
        <div className="mt-3">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-white/[0.03] p-2 text-center">
              <p className="text-xs text-white/30">Avg</p>
              <p className="text-sm font-bold text-white">${result.avgPrice}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2 text-center">
              <p className="text-xs text-white/30">Median</p>
              <p className="text-sm font-bold text-white">${result.medianPrice}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2 text-center">
              <p className="text-xs text-white/30">Low</p>
              <p className="text-sm font-bold text-green-400">${result.lowPrice}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2 text-center">
              <p className="text-xs text-white/30">High</p>
              <p className="text-sm font-bold text-purple-400">${result.highPrice}</p>
            </div>
          </div>

          {/* Comp list */}
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {result.comps.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-1.5"
              >
                <p className="truncate text-xs text-white/50 flex-1 mr-2">
                  {comp.title || "—"}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {comp.condition && (
                    <span className="text-[0.6rem] text-white/20">{comp.condition}</span>
                  )}
                  <span className="text-xs font-medium text-white">
                    ${comp.price.toFixed(2)}
                  </span>
                  {comp.url && (
                    <a
                      href={comp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[0.6rem] text-blue-400 hover:underline"
                    >
                      view
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.6rem] text-white/20">
            {result.compsCount} comparable{result.compsCount !== 1 ? "s" : ""} found
          </p>
        </div>
      )}
    </div>
  );
}
