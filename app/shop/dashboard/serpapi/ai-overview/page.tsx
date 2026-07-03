"use client";

import { useEffect, useState } from "react";

interface HistoryPoint {
  date: string;
  hasOverview: boolean;
  tolleyCited: boolean;
}

interface AiOverviewItem {
  keyword: string;
  hasOverview: boolean;
  tolleyCited: boolean;
  citedDomains: string[];
  competitorCount: number;
  overviewText: string | null;
  capturedAt: string;
  history: HistoryPoint[];
}

export default function AiOverviewPage() {
  const [items, setItems] = useState<AiOverviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetch("/api/serpapi/ai-overview")
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch((e) => setError(String(e)));
  }, []);

  async function triggerNow() {
    setTriggering(true);
    try {
      const res = await fetch("/api/serpapi/ai-overview/trigger", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert(`Scheduled ${json.queries ?? "?"} queries — refresh in ~1 min.`);
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">AI Overview citations</h1>
          <p className="mt-1 text-sm text-white/40">
            Daily snapshot of which keywords trigger Google&apos;s AI Overview
            block and whether tolley.io is cited. Cron runs daily 08:00 UTC.
          </p>
        </div>
        <button
          onClick={triggerNow}
          disabled={triggering}
          className="shop-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {triggering ? "Triggering…" : "Run now"}
        </button>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}
      {items == null && !error && (
        <p className="text-sm text-white/40">Loading…</p>
      )}

      {items && items.filter((i) => i.hasOverview && !i.tolleyCited).length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-amber-200">
            Content opportunities
          </h2>
          <p className="mt-0.5 text-xs text-white/50">
            Keywords where Google&apos;s AI Overview is showing answers but
            tolley.io is NOT cited. Each one is a content brief — write a page
            that answers the query, optimize for citation by the cited
            competitor domains.
          </p>
          <div className="mt-3 space-y-2">
            {items
              .filter((i) => i.hasOverview && !i.tolleyCited)
              .map((i) => (
                <div
                  key={`gap-${i.keyword}`}
                  className="rounded border border-white/10 bg-black/20 p-3"
                >
                  <div className="text-sm font-medium text-white">
                    {i.keyword}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    Currently cited:{" "}
                    {i.citedDomains.length > 0
                      ? i.citedDomains.slice(0, 6).join(", ")
                      : "none yet"}
                  </div>
                  {i.overviewText && (
                    <div className="mt-2 max-h-20 overflow-hidden text-[0.7rem] italic text-white/40">
                      {i.overviewText.slice(0, 280)}…
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-white/60">
            No checks yet. Click <strong>Run now</strong> above.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-white/50">
              <tr>
                <th className="py-2 pr-3">Keyword</th>
                <th className="py-2 pr-3">AI Overview</th>
                <th className="py-2 pr-3">Tolley cited</th>
                <th className="py-2 pr-3">Competitors</th>
                <th className="py-2 pr-3">Cited domains</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.keyword} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-3 font-medium text-white">
                    {item.keyword}
                  </td>
                  <td className="py-3 pr-3">
                    {item.hasOverview ? (
                      <span className="text-emerald-300">Yes</span>
                    ) : (
                      <span className="text-white/30">No</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {item.tolleyCited ? (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        cited
                      </span>
                    ) : item.hasOverview ? (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                        missing
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-white/60">
                    {item.competitorCount}
                  </td>
                  <td className="py-3 pr-3 text-xs text-white/50">
                    {item.citedDomains.slice(0, 6).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
