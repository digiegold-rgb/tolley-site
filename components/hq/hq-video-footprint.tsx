"use client";

import { useEffect, useState } from "react";

// Local disk footprint + self-hosting savings, pushed nightly by the DGX
// (video-disk-footprint.py --push, 03:20 cron).
//
// This answers two things the cost ledger structurally cannot:
//   1. How much disk the pipelines are actually holding. VideoCost only knows
//      what a render COST, never what it still occupies — and intermediates
//      (keyframes, TTS wavs, ffmpeg segments) outweigh the deliverables.
//   2. How many finished renders never got a ledger row at all. videoKey is an
//      absolute render path, so a video only lands here if some sync source
//      knows to look for it; test renders and bitcoin-kids cuts never did.
//
// The savings block is computed on the DGX from live ledger volume, not from
// constants baked in here, so it re-derives itself every night.

interface Root {
  label: string;
  path: string;
  temp: boolean;
  files_all: number;
  bytes_all: number;
  files_30: number;
  bytes_30: number;
  videos_all: number;
  videos_30: number;
  invisible: number;
  invisible_bytes: number;
}

interface Tier {
  tier: string;
  rate: number;
  total: number;
  ours: number;
  savings: number;
  multiple: number | null;
}

interface Payload {
  pending?: boolean;
  windowDays: number;
  generatedAt: string;
  collectedAt: string;
  ledgerKeys: number;
  roots: Root[];
  byKind: Record<string, { files: number; bytes: number }>;
  invisible: { count: number; recentCount: number; bytes: number };
  totals: {
    filesAll: number;
    bytesAll: number;
    files30: number;
    bytes30: number;
    videosAll: number;
    videos30: number;
    tempBytes30: number;
  };
  priorTotals: { bytesAll?: number } | null;
  savings?: {
    videos: number;
    clipsLogged: number;
    visibility: number;
    attempts: number;
    ourSpend: number;
    tiers: Tier[];
    maxSavings: number;
    maxSavingsTier: string | null;
    error?: string;
  };
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function size(bytes: number): string {
  return bytes >= GB ? `${(bytes / GB).toFixed(2)} GB` : `${(bytes / MB).toFixed(0)} MB`;
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CELL: React.CSSProperties = { padding: "5px 8px", fontSize: 12 };
const NUM: React.CSSProperties = { ...CELL, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export function HqVideoFootprint() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/hq/video-footprint")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Payload) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) {
    return (
      <div style={{ fontSize: 12, color: "#b3261e", marginBottom: 22 }}>
        Disk footprint unavailable: {error}
      </div>
    );
  }
  if (!data) return null;
  if (data.pending) {
    return (
      <div style={{ padding: 14, marginBottom: 22, fontSize: 13, color: "#6e6e73", border: "1px dashed #d1d1d6", borderRadius: 10 }}>
        No disk footprint yet — the nightly scan (<code>video-disk-footprint.py --push</code>) has not run.
      </div>
    );
  }

  const t = data.totals;
  const grew = data.priorTotals?.bytesAll ? t.bytesAll - data.priorTotals.bytesAll : null;
  const s = data.savings;

  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "#6e6e73", margin: "0 0 10px" }}>
        Local footprint &amp; self-hosting savings
      </h3>

      {/* ── headline: total disk + what self-hosting saves ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap",
          padding: "16px 18px", borderRadius: 12, marginBottom: 14,
          background: "#eef7f0", border: "1px solid #c6e3cf",
        }}
      >
        <div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>{size(t.bytesAll)}</div>
          <div style={{ fontSize: 11, color: "#6e6e73" }}>
            total on disk · {t.filesAll.toLocaleString()} files · {t.videosAll} videos
          </div>
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{size(t.bytes30)}</div>
          <div style={{ fontSize: 11, color: "#6e6e73" }}>
            written in {data.windowDays}d
            {grew !== null && (
              <span style={{ color: grew > 0 ? "#b3261e" : "#1a7f37" }}>
                {" "}· {grew > 0 ? "+" : ""}{size(Math.abs(grew))} vs 30d ago
              </span>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: data.invisible.count ? "#b3261e" : "#1a7f37" }}>
            {data.invisible.count}
          </div>
          <div style={{ fontSize: 11, color: "#6e6e73" }}>
            renders with no ledger row · {size(data.invisible.bytes)}
          </div>
        </div>
        {s && !s.error && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1a7f37", letterSpacing: -0.4 }}>
              {money(s.maxSavings)}
            </div>
            <div style={{ fontSize: 11, color: "#6e6e73" }}>max saved/mo vs commercial</div>
          </div>
        )}
      </div>

      {/* ── where the bytes are ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e5ea", color: "#6e6e73", fontSize: 11 }}>
            <th style={{ ...CELL, textAlign: "left" }}>Location</th>
            <th style={NUM}>Files {data.windowDays}d</th>
            <th style={NUM}>Size {data.windowDays}d</th>
            <th style={NUM}>Size total</th>
            <th style={NUM}>Unledgered</th>
          </tr>
        </thead>
        <tbody>
          {data.roots
            .slice()
            .sort((a, b) => b.bytes_all - a.bytes_all)
            .map((r) => (
              <tr key={r.label} style={{ borderBottom: "1px solid #f2f2f7" }}>
                <td style={{ ...CELL, color: r.temp ? "#8e8e93" : undefined }}>
                  {r.label}
                  {r.temp && <span style={{ fontSize: 10, marginLeft: 6 }}>scratch</span>}
                </td>
                <td style={NUM}>{r.files_30.toLocaleString()}</td>
                <td style={NUM}>{size(r.bytes_30)}</td>
                <td style={NUM}>{size(r.bytes_all)}</td>
                <td style={{ ...NUM, color: r.invisible ? "#b3261e" : "#c7c7cc" }}>
                  {r.invisible || "—"}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* ── savings comparison ── */}
      {s && !s.error && s.tiers?.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#6e6e73", marginBottom: 6 }}>
            {s.videos} videos · {s.clipsLogged.toLocaleString()} logged clips ÷{" "}
            {(s.visibility * 100).toFixed(0)}% ledger visibility ={" "}
            <strong>{s.attempts.toLocaleString()} true attempts</strong> — commercial APIs bill
            per attempt, including retries and failures.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e5ea", color: "#6e6e73", fontSize: 11 }}>
                <th style={{ ...CELL, textAlign: "left" }}>Tier / Provider</th>
                <th style={NUM}>Rate/clip</th>
                <th style={NUM}>Would have paid</th>
                <th style={NUM}>Our spend</th>
                <th style={NUM}>Net savings</th>
              </tr>
            </thead>
            <tbody>
              {s.tiers
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((r) => (
                  <tr key={r.tier} style={{ borderBottom: "1px solid #f2f2f7" }}>
                    <td style={CELL}>{r.tier}</td>
                    <td style={NUM}>${r.rate.toFixed(2)}</td>
                    <td style={NUM}>{money(r.total)}</td>
                    <td style={{ ...NUM, color: "#6e6e73" }}>{money(r.ours)}</td>
                    <td style={{ ...NUM, fontWeight: 600, color: "#1a7f37" }}>{money(r.savings)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#6e6e73", marginTop: 8 }}>
            Our figure is billed Modal cash plus $0 local compute — it excludes DGX hardware
            amortisation and electricity, which are real but already sunk.
          </div>
        </>
      )}

      <div style={{ fontSize: 10, color: "#8e8e93", marginTop: 10 }}>
        Scanned {new Date(data.collectedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} ·
        compared against {data.ledgerKeys} ledger rows
      </div>
    </div>
  );
}
