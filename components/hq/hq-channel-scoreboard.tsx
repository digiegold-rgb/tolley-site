"use client";

import { useCallback, useEffect, useState } from "react";

interface OutRow {
  channel: string;
  out7d: number | null;
  target: number;
  healthy: boolean | null;
  detail: string;
}
interface Payload {
  calibratedAt: string | null;
  out: OutRow[];
  trafficIn: { source: string | null; visits30d: number }[];
  leadsIn: { source: string; leads30d: number }[];
}

// Distribution scoreboard — output pace per channel (nightly calibration)
// next to what actually comes back (visits + leads by source, 30d).
export function HqChannelScoreboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hq/channel-stats");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <div className="panel" style={{ color: "#f87171" }}>Channel scoreboard failed: {error}</div>;
  if (!data) return null;

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: "0 0 8px" }}>📡 Distribution — out vs in</h3>
        <span style={{ fontSize: 12, opacity: 0.55 }}>
          Output from nightly calibration{data.calibratedAt ? ` (${new Date(data.calibratedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT)` : ""} · inbound = 30 days
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        {data.out.map((o) => {
          const pct = o.out7d != null ? Math.min(100, Math.round((o.out7d / o.target) * 100)) : 0;
          const color = o.healthy === false ? "#f87171" : pct >= 80 ? "#2dd4a7" : "#fbbf24";
          return (
            <div key={o.channel} style={{ border: "1px solid rgba(148,163,184,0.25)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.channel}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>
                {o.out7d ?? "—"}<span style={{ fontSize: 12, opacity: 0.6, fontWeight: 400 }}> / {o.target} wk</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(148,163,184,0.2)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>TRAFFIC IN (by source, 30d)</div>
          {data.trafficIn.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>No referred visits yet.</div>}
          {data.trafficIn.map((t) => (
            <div key={t.source ?? "?"} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
              <span>{t.source ?? "unknown"}</span><strong>{t.visits30d}</strong>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>LEADS IN (by source, 30d)</div>
          {data.leadsIn.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>No leads yet — this is the number to move.</div>}
          {data.leadsIn.map((l) => (
            <div key={l.source} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
              <span>{l.source}</span><strong>{l.leads30d}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
