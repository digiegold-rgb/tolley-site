"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";

// City search rankings — the monthly SerpAPI sweep answering whether the
// per-city listings videos actually rank for "new homes {city}". This is the
// KPI the 33-city expansion is judged on: views were never the point, search
// placement is.

interface RankRow {
  city: string;
  st: string;
  engine: string; // google | youtube
  position: number | null;
  foundUrl: string | null;
  checkedAt: string;
  prevPosition?: number | null;
}

interface Payload {
  ranks: RankRow[];
  lastSweep: string | null;
}

function delta(r: RankRow): string {
  if (r.prevPosition == null || r.position == null) return "";
  const d = r.prevPosition - r.position; // positive = moved up
  if (d === 0) return "·";
  return d > 0 ? `▲${d}` : `▼${-d}`;
}

export default function HqCityRanks() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);

  // The panel renders nothing until the first sweep, so a failed load and "no
  // data yet" look identical. Toast so a broken endpoint can't hide as "the
  // sweep hasn't run".
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/city-ranks")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setData(null);
        toast({
          title: "City ranks failed to load",
          description: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (!data || !data.lastSweep) return null; // nothing until the first sweep

  const byCity = new Map<string, { google?: RankRow; youtube?: RankRow }>();
  for (const r of data.ranks) {
    const key = `${r.city}, ${r.st}`;
    const slot = byCity.get(key) ?? {};
    if (r.engine === "google") slot.google = r;
    else if (r.engine === "youtube") slot.youtube = r;
    byCity.set(key, slot);
  }
  const cities = Array.from(byCity.entries()).sort((a, b) => {
    const ap = Math.min(a[1].google?.position ?? 99, a[1].youtube?.position ?? 99);
    const bp = Math.min(b[1].google?.position ?? 99, b[1].youtube?.position ?? 99);
    return ap - bp;
  });
  const ranked = data.ranks.filter((r) => r.position != null).length;
  const shown = open ? cities : cities.slice(0, 8);

  const cell = (r?: RankRow) =>
    r?.position != null ? (
      <span style={{ fontWeight: 700, color: r.position <= 5 ? "var(--hq-green)" : "#1d1d1f" }}>
        #{r.position} <span style={{ fontWeight: 400, fontSize: 10, color: "var(--hq-ink-2)" }}>{delta(r)}</span>
      </span>
    ) : (
      <span style={{ color: "#c7c7cc" }}>—</span>
    );

  return (
    <div style={{ border: "1px solid var(--hq-line)", borderRadius: 12, padding: "12px 14px", background: "#fff", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🔎 City search ranks</span>
        <span style={{ fontSize: 12, color: "var(--hq-ink-2)" }}>
          {ranked}/{data.ranks.length} placements found · sweep {new Date(data.lastSweep).toLocaleDateString()}
        </span>
        <button
          onClick={() => setOpen(!open)}
          style={{ marginLeft: "auto", fontSize: 12, color: "var(--hq-blue)", background: "none", border: "none", cursor: "pointer" }}
        >
          {open ? "collapse" : `all ${cities.length}`}
        </button>
      </div>
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 360 }}>
          <thead>
            <tr style={{ color: "var(--hq-ink-2)", textAlign: "left" }}>
              <th style={{ padding: "3px 10px 3px 0", fontWeight: 600 }}>City</th>
              <th style={{ padding: "3px 10px", fontWeight: 600 }}>Google</th>
              <th style={{ padding: "3px 10px", fontWeight: 600 }}>YouTube</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(([label, slot]) => (
              <tr key={label} style={{ borderTop: "1px solid #f2f2f7" }}>
                <td style={{ padding: "4px 10px 4px 0", whiteSpace: "nowrap" }}>{label}</td>
                <td style={{ padding: "4px 10px" }}>{cell(slot.google)}</td>
                <td style={{ padding: "4px 10px" }}>
                  {slot.youtube?.foundUrl ? (
                    <a href={slot.youtube.foundUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      {cell(slot.youtube)}
                    </a>
                  ) : (
                    cell(slot.youtube)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
