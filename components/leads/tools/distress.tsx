"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface DistressSignal {
  id: string;
  leadId: string | null;
  taskId: string | null;
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
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    fetch(`/api/serpapi/distress?status=${filter}`)
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Could not load signals");
        return json;
      })
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
    setSaving(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/serpapi/distress/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save signal");
      if (json.taskId) setNotice("Saved to Today. Review the source and verify the property and contact before outreach.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally { setSaving(null); }
  }

  const STATUSES = ["all", "new", "reviewed", "promoted", "dismissed"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Distressed-seller signals</h1>
          <p className="mt-1 text-sm text-white/40">
            Review public-source candidates and verify the address and owner. Add an opportunity to Today to save a lead and your next verification step.
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

      <div className="flex flex-wrap gap-2">
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

      {error && <div role="alert" className="text-sm text-red-400">{error} <Link href="/leads" className="underline">Open Today</Link></div>}
      {notice && <p role="status" className="text-sm text-teal-200">{notice} <Link href="/leads" className="underline">Open Today</Link></p>}
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
                      <span className="text-white/40">Possible owner:</span> {s.ownerGuess}
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
                  <div className="mt-1 flex flex-wrap justify-end gap-2">
                    {s.taskId && <Link href="/leads" className="text-xs text-teal-200 underline">Saved to Today</Link>}
                    {s.leadId && <Link href={`/leads/${encodeURIComponent(s.leadId)}`} className="text-xs text-teal-200 underline">Open lead</Link>}
                    {s.status === "dismissed" && <button disabled={saving !== null} onClick={() => updateStatus(s.id, "new")} className="text-xs text-white/60 underline">Restore for review</button>}
                    {!s.taskId && s.status !== "dismissed" && (
                      <button
                        disabled={saving !== null}
                        onClick={() => updateStatus(s.id, "promoted")}
                        className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-500/30"
                      >
                        {saving === s.id ? "Saving…" : "Add to Today"}
                      </button>
                    )}
                    {s.status !== "dismissed" && (
                      <button
                        disabled={saving !== null}
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
