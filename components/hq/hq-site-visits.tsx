"use client";

import { useCallback, useEffect, useState } from "react";

interface Daily {
  date: string;
  views: number;
  visitors: number;
}
interface Payload {
  days: number;
  totals: { views: number; visitors: number; prevViews: number; prevVisitors: number };
  daily: Daily[];
  topPaths: { path: string; views: number; visitors: number }[];
  sources: { source: string; views: number }[];
  countries: { country: string; views: number }[];
  gsc: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    topQueries: { query: string; clicks: number; impressions: number }[];
    topPages: { page: string; clicks: number; impressions: number }[];
  } | null;
}

// Literal hex, not var(--hq-…): these feed SVG presentation attributes
// (fill=/stroke= on the chart), where var() is not reliably resolved. Keep them
// in sync with --hq-blue / --hq-ink-2 in app/hq/hq.css.
const ACCENT = "#0071e3";
const INK = "#1a1a1a";
const INK2 = "#6e6e73";
const RANGES = [7, 28, 90] as const;

function delta(cur: number, prev: number): { text: string; color: string } | null {
  if (prev === 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: "±0%", color: INK2 };
  return pct > 0
    ? { text: `▲ ${pct}%`, color: "#1d9a6c" }
    : { text: `▼ ${Math.abs(pct)}%`, color: "#d0342c" };
}

function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

// ─── Daily bar chart (single series → no legend; hover tooltip per bar) ───
function DailyBars({ daily }: { daily: Daily[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 1000;
  const H = 220;
  const PAD_L = 34;
  const PAD_B = 20;
  const plotW = W - PAD_L - 6;
  const plotH = H - PAD_B - 8;

  const max = Math.max(1, ...daily.map((d) => d.views));
  // Round the axis top up to a clean step so gridline labels aren't ragged.
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;

  const n = daily.length;
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(26, slot - 2)); // ≥2px gap between bars

  // Label roughly every 7th day on 28/90-day ranges, every day on 7.
  const labelEvery = n <= 10 ? 1 : n <= 40 ? 7 : 14;

  const h = hover != null ? daily[hover] : null;
  const hoverLeftPct = hover != null ? ((PAD_L + hover * slot + slot / 2) / W) * 100 : 0;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Site visits per day"
        onMouseLeave={() => setHover(null)}
      >
        {/* recessive gridlines + y labels */}
        {[1, 2, 3, 4].map((i) => {
          const y = 8 + plotH - (plotH * i) / 4;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - 6} y1={y} y2={y} stroke="#ececf0" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" fontSize={11} fill={INK2}>
                {step * i}
              </text>
            </g>
          );
        })}
        <line x1={PAD_L} x2={W - 6} y1={8 + plotH} y2={8 + plotH} stroke="#d6d6db" strokeWidth={1} />

        {daily.map((d, i) => {
          const bh = top ? (d.views / top) * plotH : 0;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = 8 + plotH - bh;
          return (
            <g key={d.date}>
              {/* invisible full-height hit target — bigger than the mark */}
              <rect
                x={PAD_L + i * slot}
                y={8}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(bh, d.views > 0 ? 2 : 0)}
                rx={Math.min(3, barW / 2)}
                fill={hover === i ? "#0059b3" : ACCENT}
                style={{ pointerEvents: "none" }}
              />
              {i % labelEvery === 0 && (
                <text
                  x={PAD_L + i * slot + slot / 2}
                  y={H - 5}
                  textAnchor="middle"
                  fontSize={11}
                  fill={INK2}
                >
                  {fmtDay(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && (
        <div
          style={{
            position: "absolute",
            left: `${hoverLeftPct}%`,
            top: 0,
            transform: `translateX(${hoverLeftPct > 80 ? "-100%" : "-50%"})`,
            background: "#1d1d1f",
            color: "#fff",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700 }}>{h.date}</div>
          <div>
            {h.views} visit{h.views === 1 ? "" : "s"} · {h.visitors} visitor{h.visitors === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={{ border: "1px solid #e6e8eb", borderRadius: 10, padding: "10px 14px", minWidth: 130 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: INK2, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 600, color: subColor ?? INK2 }}>{sub}</div>}
    </div>
  );
}

function RankTable({
  title,
  rows,
  cols,
}: {
  title: string;
  rows: (string | number)[][];
  cols: string[];
}) {
  const maxVal = Math.max(1, ...rows.map((r) => Number(r[1]) || 0));
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: INK2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {title}
      </div>
      {rows.length === 0 && <div style={{ fontSize: 12, color: INK2 }}>Nothing yet.</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={c}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  fontWeight: 600,
                  color: INK2,
                  fontSize: 11,
                  padding: "2px 4px",
                  borderBottom: "1px solid #ececf0",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <td style={{ padding: "3px 4px", maxWidth: 220, position: "relative" }}>
                {/* in-cell magnitude bar behind the label — scannable without a second chart */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 3,
                    bottom: 3,
                    width: `${Math.round(((Number(r[1]) || 0) / maxVal) * 100)}%`,
                    background: "rgba(0,113,227,0.09)",
                    borderRadius: 4,
                  }}
                />
                <span style={{ position: "relative", overflowWrap: "anywhere", color: INK }}>{r[0]}</span>
              </td>
              {r.slice(1).map((v, ci) => (
                <td key={ci} style={{ padding: "3px 4px", textAlign: "right", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Site Visits — first-party traffic across tolley.io (bots, datacenter hits,
// self-IPs, and admin paths excluded server-side) + Google Search Console.
export function HqSiteVisits() {
  const [days, setDays] = useState<number>(28);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hq/site-visits?days=${d}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [load, days]);

  if (error) return <div className="panel" style={{ color: "#d0342c" }}>Site visits failed: {error}</div>;
  if (!data) return <div className="panel" style={{ color: INK2 }}>Loading site visits…</div>;

  const dViews = delta(data.totals.views, data.totals.prevViews);
  const dVisitors = delta(data.totals.visitors, data.totals.prevVisitors);

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>🌐 Site visits — tolley.io</h3>
          <span style={{ fontSize: 12, color: INK2 }}>
            External traffic only (bots, datacenters, your own IPs & admin pages excluded)
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                disabled={loading}
                style={{
                  padding: "4px 12px",
                  borderRadius: 14,
                  border: "1px solid var(--hq-border)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: days === r ? "#1d1d1f" : "#fff",
                  color: days === r ? "#fff" : INK,
                }}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <StatTile
            label={`Visits (${data.days}d)`}
            value={data.totals.views.toLocaleString()}
            sub={dViews ? `${dViews.text} vs prior ${data.days}d` : undefined}
            subColor={dViews?.color}
          />
          <StatTile
            label="Unique visitors"
            value={data.totals.visitors.toLocaleString()}
            sub={dVisitors ? `${dVisitors.text} vs prior ${data.days}d` : undefined}
            subColor={dVisitors?.color}
          />
          {data.gsc && (
            <>
              <StatTile label="Google clicks" value={data.gsc.clicks.toLocaleString()} sub="Search Console" />
              <StatTile
                label="Google impressions"
                value={data.gsc.impressions.toLocaleString()}
                sub={`${(data.gsc.ctr * 100).toFixed(1)}% CTR · avg pos ${data.gsc.position.toFixed(1)}`}
              />
            </>
          )}
        </div>

        <DailyBars daily={data.daily} />
      </div>

      <div className="panel">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          <RankTable
            title={`Top pages (${data.days}d)`}
            cols={["Page", "Visits", "Visitors"]}
            rows={data.topPaths.slice(0, 15).map((p) => [p.path, p.views, p.visitors])}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <RankTable
              title="Sources"
              cols={["Source", "Visits"]}
              rows={data.sources.map((s) => [s.source, s.views])}
            />
            <RankTable
              title="Countries"
              cols={["Country", "Visits"]}
              rows={data.countries.map((c) => [c.country, c.views])}
            />
          </div>
          {data.gsc && (
            <RankTable
              title="Google searches that found you"
              cols={["Query", "Clicks", "Impr."]}
              rows={data.gsc.topQueries.map((q) => [q.query, q.clicks, q.impressions])}
            />
          )}
        </div>
      </div>
    </>
  );
}
