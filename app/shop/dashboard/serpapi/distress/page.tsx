"use client";

import { useEffect, useState, useCallback } from "react";

interface DistressSignal {
  id: string;
  kind: string;
  source: string;
  sourceUrl: string | null;
  title: string;
  snippet: string | null;
  addressGuess: string | null;
  ownerGuess: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface DistressResponse {
  signals: DistressSignal[];
  counts: Record<string, number>;
}

const KIND_LABEL: Record<string, string> = {
  foreclosure: "🏚️ Foreclosure / Trustee Sale",
  "tax-sale": "💸 Tax-Delinquency Sale",
  "sheriff-sale": "⚖️ Sheriff Sale",
  "code-violation": "🚧 Code Violation",
};

export default function DistressPage() {
  const [data, setData] = useState<DistressResponse | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const reload = useCallback(() => {
    fetch(`/api/serpapi/distress?status=${filter}`)
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
      const res = await fetch("/api/serpapi/distress/trigger", { method: "POST" });
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
    const res = await fetch(`/api/serpapi/distress/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) reload();
  }

  const STATUSES = ["all", "new", "reviewed", "promoted", "dismissed"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Distressed-seller signals</h1>
          <p className="mt-1 text-sm text-white/40">
            Pre-foreclosure, trustee &amp; sheriff sales, tax-delinquency lists,
            and code-violation dockets in Jackson County via SerpAPI. New finds
            are pushed to Telegram + email weekly — this is the review queue.
            Cron runs Thursdays 09:30 UTC.
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
                ? "bg-amber-500/30 text-amber-200"
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
                <div className="min-w-0">
                  <div className="text-xs font-medium text-amber-300/80">
                    {KIND_LABEL[s.kind] ?? s.kind}
                  </div>
                  <div className="mt-0.5 font-semibold text-white">{s.title}</div>
                  <div className="text-xs text-white/40">
                    {[s.addressGuess, s.city, s.county, s.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {s.ownerGuess && (
                    <div className="mt-1 text-xs text-white/70">
                      <span className="text-white/40">Owner:</span> {s.ownerGuess}
                    </div>
                  )}
                  {s.snippet && (
                    <div className="mt-1 line-clamp-2 text-xs text-white/50">
                      {s.snippet}
                    </div>
                  )}
                  {s.sourceUrl && (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-amber-300 hover:underline"
                    >
                      {s.source} →
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
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
