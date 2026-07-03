"use client";

import { useEffect, useState, useCallback } from "react";

interface Heir {
  name: string;
  relationship: string | null;
  source: string;
}

interface ProbateSignal {
  id: string;
  source: string;
  sourceUrl: string | null;
  decedentName: string;
  decedentAge: number | null;
  obitDate: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  matchedAddress: string | null;
  estimatedValue: number | null;
  heirsJson: Heir[] | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface ProbateResponse {
  signals: ProbateSignal[];
  counts: Record<string, number>;
}

export default function ProbatePage() {
  const [data, setData] = useState<ProbateResponse | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const reload = useCallback(() => {
    fetch(`/api/serpapi/probate?status=${filter}`)
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch((e) => setError(String(e)));
  }, [filter]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function triggerScan() {
    setTriggering(true);
    try {
      const res = await fetch("/api/serpapi/probate/trigger", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert("Scheduled — refresh in ~1-2 min.");
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTriggering(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/serpapi/probate/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) reload();
  }

  const STATUSES = [
    "all",
    "discovered",
    "enriched",
    "promoted",
    "dismissed",
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Probate signals</h1>
          <p className="mt-1 text-sm text-white/40">
            Recent KC-area obituaries discovered via SerpAPI google-search,
            enriched with heir candidates. Promote a signal to push it into the
            T-Agent dossier pipeline. Cron runs daily 09:00 UTC.
          </p>
        </div>
        <button
          onClick={triggerScan}
          disabled={triggering}
          className="shop-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {triggering ? "Scanning…" : "Scan now"}
        </button>
      </div>

      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1 text-xs ${
              filter === s
                ? "bg-purple-500/30 text-purple-200"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {s}
            {data?.counts[s] != null && (
              <span className="ml-1 text-white/40">({data.counts[s]})</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}
      {!data && !error && <p className="text-sm text-white/40">Loading…</p>}

      {data && data.signals.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-white/60">
            No signals in this view. Click <strong>Scan now</strong> above.
          </p>
        </div>
      )}

      {data && data.signals.length > 0 && (
        <div className="space-y-3">
          {data.signals.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">
                    {s.decedentName}
                    {s.decedentAge != null && (
                      <span className="ml-2 text-sm text-white/50">
                        age {s.decedentAge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/40">
                    {[s.city, s.county, s.state].filter(Boolean).join(" · ")}
                    {s.obitDate &&
                      ` · obit ${new Date(s.obitDate).toLocaleDateString()}`}
                  </div>
                  {s.heirsJson && s.heirsJson.length > 0 && (
                    <div className="mt-2 text-xs text-white/70">
                      <span className="text-white/40">Heirs found:</span>{" "}
                      {s.heirsJson
                        .map((h) =>
                          h.relationship ? `${h.name} (${h.relationship})` : h.name
                        )
                        .join(", ")}
                    </div>
                  )}
                  {s.sourceUrl && (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-purple-300 hover:underline"
                    >
                      {s.source} →
                    </a>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/60">
                    {s.status}
                  </span>
                  <div className="mt-1 flex gap-1">
                    {s.status !== "promoted" && (
                      <button
                        onClick={() => updateStatus(s.id, "promoted")}
                        className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-500/30"
                      >
                        Promote
                      </button>
                    )}
                    {s.status !== "dismissed" && (
                      <button
                        onClick={() => updateStatus(s.id, "dismissed")}
                        className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/30"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
