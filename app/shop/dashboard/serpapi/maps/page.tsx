"use client";

import { useEffect, useState } from "react";

interface RankRow {
  keyword: string;
  zip: string;
  businessName: string;
  position: number | null;
  totalResults: number | null;
  rating: number | null;
  reviews: number | null;
  rawTitle: string | null;
  capturedAt: string;
}

interface CompetitorEntry {
  position: number | null;
  title: string | null;
  placeId: string | null;
  rating: number | null;
  reviews: number | null;
  address: string | null;
}

interface CompetitorRow {
  keyword: string;
  zip: string;
  topResults: CompetitorEntry[];
  totalResults: number;
  capturedAt: string;
}

interface RankResponse {
  latest: RankRow[];
  competitors: CompetitorRow[];
  runCount: number;
}

function positionLabel(pos: number | null): string {
  if (pos == null) return "—";
  if (pos <= 3) return `#${pos} 🟢`;
  if (pos <= 10) return `#${pos} 🟡`;
  return `#${pos}`;
}

export default function MapsPackPage() {
  const [data, setData] = useState<RankResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetch("/api/serpapi/maps-pack")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  async function triggerNow() {
    setTriggering(true);
    try {
      const res = await fetch("/api/serpapi/maps-pack/trigger", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert(`Scheduled ${json.expectedQueries ?? "?"} queries — refresh in ~2 min.`);
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTriggering(false);
    }
  }

  // Group latest rows by (keyword, businessName) so each row in the table
  // shows the per-zip rank breakdown for one keyword/business pair.
  const grouped = new Map<string, RankRow[]>();
  if (data) {
    for (const row of data.latest) {
      const key = `${row.keyword}::${row.businessName}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Maps Pack rankings</h1>
          <p className="mt-1 text-sm text-white/40">
            Weekly snapshot of where your businesses appear on Google Maps for
            target keywords across the KC metro. Lower position = higher rank.
            Cron runs Wednesdays 07:00 UTC.
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

      {data == null && !error && (
        <p className="text-sm text-white/40">Loading…</p>
      )}

      {data && data.latest.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-white/60">
            No snapshots yet. Click <strong>Run now</strong> above to capture
            the first batch (~2 minutes), or wait for the Wednesday cron.
          </p>
        </div>
      )}

      {data && data.competitors && data.competitors.length > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div>
            <h2 className="text-sm font-semibold text-amber-200">
              Who&apos;s in the pack (top 5 per keyword × zip)
            </h2>
            <p className="mt-0.5 text-xs text-white/40">
              These are the competitors you need to outrank. Reviews count =
              the #1 weighted Maps Pack ranking factor. The Δ column shows
              how many more reviews you&apos;d need to match each competitor
              based on your latest tracked rating.
            </p>
          </div>
          <div className="space-y-3">
            {data.competitors.map((c) => {
              // Find our highest-tracked review count for this (kw, zip)
              const ourLatest = data.latest
                .filter(
                  (r) =>
                    r.keyword === c.keyword &&
                    r.zip === c.zip &&
                    r.reviews != null
                )
                .sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0))[0];
              const ourReviews = ourLatest?.reviews ?? 0;

              return (
                <div
                  key={`${c.keyword}-${c.zip}`}
                  className="rounded border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex items-baseline justify-between text-xs">
                    <div className="font-medium text-white">{c.keyword}</div>
                    <div className="text-white/40">
                      {c.zip} · {c.totalResults} results · we have {ourReviews} review{ourReviews !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {c.topResults.length === 0 && (
                      <div className="text-xs text-white/40">No GBPs returned</div>
                    )}
                    {c.topResults.map((r, idx) => {
                      const compReviews = r.reviews ?? 0;
                      const delta = compReviews - ourReviews;
                      const isUs =
                        ourLatest?.rawTitle &&
                        r.title &&
                        r.title.toLowerCase().includes(ourLatest.rawTitle.toLowerCase().slice(0, 12));
                      return (
                        <div
                          key={`${c.zip}-${idx}`}
                          className={`flex items-center gap-2 text-xs ${
                            isUs ? "text-purple-200" : ""
                          }`}
                        >
                          <span className="w-6 text-white/30">
                            #{r.position ?? idx + 1}
                          </span>
                          <span className="flex-1 truncate">
                            {isUs && <span className="mr-1">⭐</span>}
                            {r.title ?? "—"}
                          </span>
                          <span className="text-white/50">
                            {r.rating != null ? `★${r.rating}` : "—"} ·{" "}
                            {compReviews} reviews
                          </span>
                          <span
                            className={`w-16 text-right ${
                              isUs
                                ? "text-white/30"
                                : delta > 0
                                ? "text-amber-300"
                                : "text-emerald-300"
                            }`}
                          >
                            {isUs
                              ? "—"
                              : delta > 0
                              ? `Δ +${delta}`
                              : `−${Math.abs(delta)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data && data.latest.length > 0 && (
        <>
          <p className="text-xs text-white/40">
            {data.latest.length} observations across {data.runCount} run
            {data.runCount !== 1 ? "s" : ""}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-white/50">
                <tr>
                  <th className="py-2 pr-3">Keyword / Business</th>
                  <th className="py-2 pr-3">Per-zip rank</th>
                  <th className="py-2 pr-3">Title in pack</th>
                  <th className="py-2 pr-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(grouped.entries()).map(([key, rows]) => {
                  const [keyword, business] = key.split("::");
                  const titleSeen = rows.find((r) => r.rawTitle)?.rawTitle;
                  const ratingSeen = rows.find((r) => r.rating != null);
                  return (
                    <tr
                      key={key}
                      className="border-b border-white/5 align-top"
                    >
                      <td className="py-3 pr-3">
                        <div className="font-medium text-white">{business}</div>
                        <div className="mt-0.5 text-xs text-white/40">
                          {keyword}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="space-y-1">
                          {rows
                            .sort((a, b) => a.zip.localeCompare(b.zip))
                            .map((r) => (
                              <div key={r.zip} className="text-xs">
                                <span className="text-white/40">{r.zip}:</span>{" "}
                                <span className="text-white/85">
                                  {positionLabel(r.position)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-xs text-white/60">
                        {titleSeen ?? "—"}
                      </td>
                      <td className="py-3 pr-3 text-xs text-white/60">
                        {ratingSeen?.rating != null
                          ? `${ratingSeen.rating} (${ratingSeen.reviews ?? "?"} reviews)`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
