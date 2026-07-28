"use client";

import { useCallback, useEffect, useState } from "react";

// Private haul appraisals — inbound FB photo messages the DGX fb-haul-appraiser
// captured, AI-appraised item-by-item. Jared-only (PIN-gated API), never shown
// to the sender.

interface HaulItem {
  name: string;
  photoIndexes: number[];
  condition: string;
  valueLow: number;
  valueHigh: number;
  confidence: number;
  notes: string;
}

interface HaulRow {
  id: string;
  at: string;
  pageName: string;
  senderName: string;
  receivedAt: string | null;
  photoUrls: Array<string | null>;
  items: HaulItem[];
  totals: { low: number; high: number; itemCount: number; photoCount: number } | null;
  standouts: string[];
  summary: string;
  comps: Array<{ query: string; count: number; medianPrice: number; avgPrice: number }>;
  senderText: string;
  error: string | null;
}

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

const CONDITION_SHORT: Record<string, string> = {
  new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor",
};

export function HqHaulAppraisals() {
  const [hauls, setHauls] = useState<HaulRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/haul-appraisals?limit=30");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { hauls: HaulRow[] };
      setHauls(j.hauls ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>💎 Haul appraisals — private</h2>
        <button className="tab-btn" onClick={() => { setLoading(true); load(); }}>
          {loading ? "…" : "Refresh"}
        </button>
        <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>
          Photos people send to your FB pages, AI-appraised item by item. Only you see this — the sender is never told.
        </span>
      </div>
      {error && <div style={{ color: "#f87171" }}>Failed to load: {error}</div>}
      {!loading && !error && hauls.length === 0 && (
        <div style={{ opacity: 0.7 }}>
          No hauls appraised yet. When someone sends photos to any page via Messenger, the
          appraisal lands here within ~5 minutes.
        </div>
      )}
      {hauls.map((h) => {
        const standoutSet = new Set(h.standouts ?? []);
        const compByQuery = new Map((h.comps ?? []).map((c) => [c.query, c]));
        return (
          <div
            key={h.id}
            style={{
              border: "1px solid rgba(148,163,184,0.25)",
              borderLeft: "3px solid #a78bfa",
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong>{h.senderName || "Unknown sender"}</strong>
              <span style={{ opacity: 0.65, fontSize: "0.85rem" }}>→ {h.pageName}</span>
              <span style={{ opacity: 0.55, fontSize: "0.78rem" }}>{ago(h.receivedAt ?? h.at)}</span>
              {h.totals && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "rgba(167,139,250,0.15)",
                    color: "#c4b5fd",
                    border: "1px solid rgba(167,139,250,0.4)",
                    borderRadius: 999,
                    padding: "2px 12px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  est ${h.totals.low}–${h.totals.high} · {h.totals.itemCount} items
                </span>
              )}
            </div>

            {h.senderText && (
              <div style={{ fontSize: "0.88rem", opacity: 0.85 }}>
                <span style={{ opacity: 0.6 }}>They said:</span> “{h.senderText}”
              </div>
            )}

            {h.photoUrls?.some(Boolean) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {h.photoUrls.map((u, i) =>
                  u ? (
                    <a key={i} href={u} target="_blank" rel="noreferrer" title={`Photo ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt={`Photo ${i + 1}`}
                        loading="lazy"
                        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, display: "block" }}
                      />
                    </a>
                  ) : null
                )}
              </div>
            )}

            {h.error && (
              <div style={{ fontSize: "0.82rem", color: "#fbbf24" }}>
                ⚠️ Partial analysis: {h.error}
              </div>
            )}

            {h.items?.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ opacity: 0.6, textAlign: "left" }}>
                      <th style={{ padding: "4px 10px 4px 0" }}>Item</th>
                      <th style={{ padding: "4px 10px" }}>Cond</th>
                      <th style={{ padding: "4px 10px", whiteSpace: "nowrap" }}>Est value</th>
                      <th style={{ padding: "4px 10px" }}>Conf</th>
                      <th style={{ padding: "4px 10px", whiteSpace: "nowrap" }}>eBay sold ~</th>
                      <th style={{ padding: "4px 0" }}>Photos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...h.items]
                      .sort((a, b) => b.valueHigh - a.valueHigh)
                      .map((it, i) => {
                        const comp = compByQuery.get(it.name);
                        const standout = standoutSet.has(it.name);
                        return (
                          <tr
                            key={i}
                            style={{
                              borderTop: "1px solid rgba(148,163,184,0.15)",
                              background: standout ? "rgba(167,139,250,0.08)" : undefined,
                            }}
                          >
                            <td style={{ padding: "5px 10px 5px 0" }} title={it.notes}>
                              {standout && "⭐ "}{it.name}
                            </td>
                            <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>
                              {CONDITION_SHORT[it.condition] ?? it.condition}
                            </td>
                            <td style={{ padding: "5px 10px", whiteSpace: "nowrap", fontWeight: 600 }}>
                              ${it.valueLow}–${it.valueHigh}
                            </td>
                            <td style={{ padding: "5px 10px", opacity: 0.7 }}>
                              {Math.round(it.confidence * 100)}%
                            </td>
                            <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>
                              {comp ? `$${comp.medianPrice} (${comp.count})` : "—"}
                            </td>
                            <td style={{ padding: "5px 0", opacity: 0.6, fontSize: "0.78rem" }}>
                              {(it.photoIndexes ?? []).join(", ")}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {h.summary && (
              <div style={{ fontSize: "0.85rem", opacity: 0.75, fontStyle: "italic" }}>{h.summary}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
