"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { isHttpUrl } from "./types";

// Video spend — what each video cost and what they have cost in total, ever.
//
// Deliberately separate from the post ledger above it: PostLogEntry is pruned
// at 90 days and only knows POSTING spend, so it can never answer "what have we
// spent on video, all-time". VideoCost rows are never pruned.
//
// Clips and lip-sync are the render pipeline's own measurements. Storyboard is
// a per-video estimate constant (Kimi K3 bills no per-call readout) and local
// renders are $0 because nothing metered ran — rows carrying either are flagged.
// A monthly "overhead" row (pipeline: overhead) carries the slice of the real
// Modal bill no shipped video claims — retries, warm pools, experiments — so
// the grand total reconciles to `modal billing report` (full scope, per Jared
// 7/31: "it makes more sense to me to see the full scope costs").

interface VideoRow {
  videoKey: string;
  pipeline: string;
  title: string | null;
  template: string | null;
  status: string;
  url: string | null;
  estimated: boolean;
  renderedAt: string;
  totalCents: number;
  clipsCents: number;
  lipsyncCents: number;
  imageCents: number;
  scriptCents: number;
  postCents: number;
}

interface LiveBill {
  provider: string;
  label: string;
  amountCents: number;
  kind: string;
  note: string | null;
  asOf: string;
}

interface Payload {
  grandTotalCents: number;
  videoCount: number;
  avgCents: number;
  estimatedCents: number;
  thisMonth: { month: string; cents: number; count: number };
  breakdown: {
    clipsCents: number;
    lipsyncCents: number;
    imageCents: number;
    scriptCents: number;
    ttsCents: number;
    postCents: number;
    overheadCents: number;
  };
  byPipeline: { pipeline: string; cents: number; count: number }[];
  byMonth: { month: string; cents: number; count: number }[];
  recent: VideoRow[];
}

const PIPELINE_LABEL: Record<string, string> = {
  shorts: "🛒 Product shorts",
  housing: "🏠 KC Housing Daily",
  listings: "🔑 New KC Homes Today",
  wd: "🧺 Washer/Dryer",
  estate: "🏛 Estate sales",
  other: "Other",
  overhead: "⚙️ Modal GPU overhead",
};

const COMPONENT_LABEL: Record<string, string> = {
  clipsCents: "AI clips (Wan/Modal)",
  lipsyncCents: "Lip-sync (fal)",
  imageCents: "Photos (Nano Banana, est)",
  scriptCents: "Storyboard (Kimi K3, est)",
  ttsCents: "Voice (ElevenLabs / local TTS)",
  postCents: "Posting (X API)",
  overheadCents: "Modal overhead (retries/experiments, real bill)",
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "America/Chicago",
  });
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-US", {
    month: "short", year: "numeric",
  });
}

export function HqVideoCosts() {
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [bills, setBills] = useState<LiveBill[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/video-costs?limit=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Payload);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
    // Real provider bills (pushed daily by the DGX collector) — shown beside the
    // renderer estimates so the two numbers can disagree honestly. If they fail
    // to load the panel shows estimates ALONE, which is the reading that
    // silently misleads, so surface it.
    fetch("/api/hq/ai-spend")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d && Array.isArray(d.rows)) setBills(d.rows);
      })
      .catch((e: unknown) => {
        toast({
          title: "Provider bills unavailable",
          description: `${e instanceof Error ? e.message : String(e)} — estimates only`,
          variant: "warning",
        });
      });
  }, [load, toast]);

  if (error) {
    return (
      <div style={{ fontSize: 12, color: "var(--hq-red)", marginBottom: 22 }}>
        Video spend unavailable: {error}
      </div>
    );
  }
  if (!data) return <div style={{ fontSize: 12, color: "var(--hq-ink-3)", marginBottom: 22 }}>Loading video spend…</div>;
  if (data.videoCount === 0) {
    return (
      <div style={{ padding: 14, marginBottom: 22, fontSize: 13, color: "var(--hq-ink-2)", border: "1px dashed var(--hq-border)", borderRadius: 10 }}>
        No video costs recorded yet — run <code>push-video-costs.mjs</code> on the DGX.
      </div>
    );
  }

  const rows = expanded ? data.recent : data.recent.slice(0, 12);

  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--hq-ink-2)", margin: "0 0 10px" }}>
        Video spend
      </h3>

      {/* ── Grand total: the number Jared asks for ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap",
          padding: "16px 18px", borderRadius: 12, marginBottom: 14,
          background: "#f5f0ff", border: "1px solid #d9c9f5",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--hq-ink-2)", fontWeight: 600 }}>ALL-TIME VIDEO SPEND</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#4a2a8a", lineHeight: 1.1 }}>
            {money(data.grandTotalCents)}
          </div>
          <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>
            {data.videoCount} videos · {money(data.avgCents)} avg all-in
          </div>
        </div>
        <div style={{ borderLeft: "1px solid #d9c9f5", paddingLeft: 22 }}>
          <div style={{ fontSize: 11, color: "var(--hq-ink-2)", fontWeight: 600 }}>
            {monthLabel(data.thisMonth.month).toUpperCase()}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{money(data.thisMonth.cents)}</div>
          <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>{data.thisMonth.count} videos</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, fontSize: 11, color: "var(--hq-ink-2)" }}>
          Full-scope: per-video renderer estimates PLUS a monthly &quot;Modal GPU overhead&quot;
          row (real metered bill minus what shipped videos claim — retries, warm pools,
          experiments), so this total reconciles to the actual Modal bill.
          {" "}{money(data.estimatedCents)} of the total carries an estimated component.
        </div>
        <button
          onClick={() => void load()}
          style={{ padding: "5px 12px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {/* ── Real provider bills — billed truth beside the estimates ── */}
      {bills.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "stretch" }}>
          {bills
            .filter((b) => ["modal", "fal", "neon"].includes(b.provider))
            .map((b) => (
              <div key={b.provider} title={b.note ?? ""} style={{ border: "1px solid #d9c9f5", borderRadius: 10, padding: "8px 14px", background: "#fbf9ff", maxWidth: 340 }}>
                <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>
                  💳 {b.label} — real bill{b.kind === "estimated" ? " (est)" : ""}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#4a2a8a" }}>{money(b.amountCents)} lifetime</div>
                {b.note && <div style={{ fontSize: 10, color: "var(--hq-ink-2)", marginTop: 2 }}>{b.note}</div>}
              </div>
            ))}
        </div>
      )}

      {/* ── Per pipeline + per component ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {data.byPipeline.map((p) => (
          <div key={p.pipeline} style={{ border: "1px solid var(--hq-line)", borderRadius: 10, padding: "8px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>{PIPELINE_LABEL[p.pipeline] ?? p.pipeline}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{money(p.cents)}</div>
            <div style={{ fontSize: 10, color: "var(--hq-ink-2)" }}>
              {p.pipeline === "overhead"
                ? `${p.count} months · real bill remainder`
                : `${p.count} videos · ${money(Math.round(p.cents / p.count))} each`}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {(Object.entries(data.breakdown) as [keyof Payload["breakdown"], number][])
          .sort((a, b) => b[1] - a[1])
          .map(([k, cents]) => (
            <div key={k} style={{ border: "1px solid var(--hq-line)", borderRadius: 10, padding: "6px 12px", background: "#fafafa" }}>
              <span style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>{COMPONENT_LABEL[k] ?? k}</span>{" "}
              <span style={{ fontSize: 13, fontWeight: 700 }}>{money(cents)}</span>
            </div>
          ))}
      </div>

      {/* ── Per month ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {data.byMonth.map((m) => (
          <div key={m.month} style={{ border: "1px solid var(--hq-line)", borderRadius: 10, padding: "6px 12px", background: "#fff" }}>
            <span style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>{monthLabel(m.month)}</span>{" "}
            <span style={{ fontSize: 13, fontWeight: 700 }}>{money(m.cents)}</span>
            <span style={{ fontSize: 10, color: "var(--hq-ink-2)" }}> · {m.count}</span>
          </div>
        ))}
      </div>

      {/* ── Per-video price ── */}
      <div style={{ border: "1px solid var(--hq-line)", borderRadius: 10, background: "#fff", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 680 }}>
          <thead>
            <tr style={{ background: "#fafafa", textAlign: "left" }}>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)" }}>Video</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)" }}>Pipeline</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)" }}>Rendered</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)", textAlign: "right" }}>Clips</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)", textAlign: "right" }}>Lip-sync</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)", textAlign: "right" }}>Photos</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)", textAlign: "right" }}>Script</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)", textAlign: "right" }}>Post</th>
              <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--hq-ink-2)", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.videoKey} style={{ borderTop: "1px solid #f0f0f2" }}>
                <td style={{ padding: "8px 12px", maxWidth: 300 }}>
                  {isHttpUrl(v.url) ? (
                    <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ color: "#0a58ca", textDecoration: "none" }}>
                      {v.title ?? v.videoKey}
                    </a>
                  ) : (
                    v.title ?? v.videoKey
                  )}
                  {v.status !== "posted" && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#fff4e5", color: "var(--hq-amber)" }}>
                      DRAFT
                    </span>
                  )}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--hq-ink-2)" }}>
                  {PIPELINE_LABEL[v.pipeline] ?? v.pipeline}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--hq-ink-2)" }}>{shortDate(v.renderedAt)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--hq-ink-2)" }}>{money(v.clipsCents)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--hq-ink-2)" }}>{money(v.lipsyncCents)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--hq-ink-2)" }}>{money(v.imageCents)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--hq-ink-2)" }}>{money(v.scriptCents)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--hq-ink-2)" }}>{money(v.postCents)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                  {money(v.totalCents)}
                  {v.estimated && <span style={{ color: "var(--hq-amber)", fontWeight: 600 }}> est</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.recent.length > 12 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: 8, padding: "5px 12px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff", cursor: "pointer" }}
        >
          {expanded ? "Show fewer" : `Show all ${data.recent.length}`}
        </button>
      )}
    </div>
  );
}
