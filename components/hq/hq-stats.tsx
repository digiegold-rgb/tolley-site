"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { readApiError } from "./types";

interface StatsVideoRow {
  videoId: string;
  title: string;
  pipeline: string;
  publishedAt: string;
  durationSec: number | null;
  day: string;
  views: number;
  likes: number;
  comments: number;
  avgViewDurationSec: number | null;
  avgViewPct: number | null;
  subsGained: number | null;
  views7d: number | null;
  views28d: number | null;
}

interface StatsPayload {
  videos: StatsVideoRow[];
  pipelines: {
    pipeline: string;
    videos: number;
    totalViews: number;
    views7d: number;
    avgViewPct: number | null;
  }[];
  firstParty: {
    siteViews30d: number;
    circleVisits30d: number;
    circleLeads30d: number;
    amazonClicks: number;
    goClicksYouTube: number;
  };
  lastPullAt: string | null;
  generatedAt: string;
}

interface Analysis {
  id: string;
  markdown: string;
  createdAt: string;
}

const PIPELINE_LABEL: Record<string, string> = {
  shorts: "Product Shorts",
  housing: "KC Housing Daily",
  listings: "New KC Homes",
  estate: "Estate Sales",
  other: "Other",
};

const PIPELINES = ["shorts", "housing", "listings", "estate", "other"] as const;

type SortKey = "views" | "views7d" | "avgViewPct" | "publishedAt";

function n(v: number | null | undefined): string {
  if (v == null) return "n/a";
  return v.toLocaleString("en-US");
}

function pct(v: number | null): string {
  return v == null ? "n/a" : `${Math.round(v)}%`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Stats tab — YouTube per-video/per-pipeline snapshots + first-party numbers,
// with the one-click Gemini "Analyze" recap. Self-fetching.
export function HqStats() {
  const { toast } = useToast();
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [reassignBusy, setReassignBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, analysisRes] = await Promise.all([
        fetch("/api/hq/stats"),
        fetch("/api/hq/stats/analyze"),
      ]);
      if (!statsRes.ok) throw new Error(await readApiError(statsRes, "Failed to load stats"));
      setData(await statsRes.json());
      if (analysisRes.ok) {
        const d = await analysisRes.json();
        setAnalysis(d.analysis ?? null);
      }
    } catch (err) {
      toast({
        title: "Failed to load stats",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function analyze() {
    setAnalyzing(true);
    try {
      const r = await fetch("/api/hq/stats/analyze", { method: "POST" });
      if (!r.ok) throw new Error(await readApiError(r, "Analyze failed"));
      const d = await r.json();
      setAnalysis(d.analysis);
      toast({ title: "Recap generated", variant: "success" });
    } catch (err) {
      toast({
        title: "Analyze failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function reassign(videoId: string, pipeline: string) {
    setReassignBusy(videoId);
    try {
      const r = await fetch("/api/hq/stats/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, pipeline }),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Update failed"));
      setData((prev) =>
        prev
          ? {
              ...prev,
              videos: prev.videos.map((v) => (v.videoId === videoId ? { ...v, pipeline } : v)),
            }
          : prev,
      );
    } catch (err) {
      toast({
        title: "Reassign failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setReassignBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="panel">
        <div style={{ fontSize: 13, color: "#999", padding: "8px 0" }}>
          {loading ? "Loading stats…" : "No stats loaded."}
        </div>
      </div>
    );
  }

  if (data.videos.length === 0) {
    return (
      <div className="panel">
        <div style={{ fontSize: 13, color: "#6e6e73", padding: "8px 0", lineHeight: 1.6 }}>
          No YouTube snapshots yet. The daily pull ( /api/cron/youtube-stats, 11:30 UTC )
          needs a token with the analytics scope — complete the one-click re-auth at{" "}
          <code>/api/social/oauth/youtube/start</code>, then the first snapshot lands on the
          next cron run.
        </div>
      </div>
    );
  }

  const filtered =
    pipelineFilter === "all"
      ? data.videos
      : data.videos.filter((v) => v.pipeline === pipelineFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "publishedAt") return b.publishedAt.localeCompare(a.publishedAt);
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    return (bv as number) - (av as number);
  });

  const th = (label: string, key?: SortKey) => (
    <th
      style={{ cursor: key ? "pointer" : undefined, whiteSpace: "nowrap" }}
      onClick={key ? () => setSortKey(key) : undefined}
    >
      {label}
      {key && sortKey === key ? " ▾" : ""}
    </th>
  );

  return (
    <div>
      {/* ─── Pipeline rollups ─── */}
      <div className="stat-row" style={{ marginTop: 0 }}>
        {data.pipelines.map((p) => (
          <div key={p.pipeline} className="stat-card">
            <h4>{PIPELINE_LABEL[p.pipeline] ?? p.pipeline}</h4>
            <div className="val" style={{ fontSize: 15 }}>
              {n(p.totalViews)}{" "}
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6e6e73" }}>
                views · {p.videos} vids
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#6e6e73" }}>
              +{n(p.views7d)} 7d · retention {pct(p.avgViewPct)}
            </div>
          </div>
        ))}
      </div>

      {/* ─── First-party strip ─── */}
      <div className="stat-row">
        <div className="stat-card accent-purple">
          <h4>Site Views (30d)</h4>
          <div className="val">{n(data.firstParty.siteViews30d)}</div>
        </div>
        <div className="stat-card">
          <h4>Circle Leads (30d)</h4>
          <div className="val">{n(data.firstParty.circleLeads30d)}</div>
        </div>
        <div className="stat-card">
          <h4>Amazon Clicks (all)</h4>
          <div className="val">{n(data.firstParty.amazonClicks)}</div>
        </div>
        <div className="stat-card">
          <h4>YT → Shop Clicks</h4>
          <div className="val">{n(data.firstParty.goClicksYouTube)}</div>
        </div>
      </div>

      {/* ─── Analyze ─── */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={analyze} disabled={analyzing}>
            {analyzing ? "Analyzing…" : "⚡ Analyze — what's working?"}
          </button>
          <span style={{ fontSize: 11, color: "#6e6e73" }}>
            {data.lastPullAt
              ? `Data pulled ${new Date(data.lastPullAt).toLocaleString("en-US")}`
              : "No pull yet"}
            {analysis
              ? ` · last recap ${new Date(analysis.createdAt).toLocaleString("en-US")}`
              : ""}
          </span>
        </div>
        {analysis && (
          <pre
            style={{
              marginTop: 10,
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.6,
              background: "#fafafa",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 12,
            }}
          >
            {analysis.markdown}
          </pre>
        )}
      </div>

      {/* ─── Per-video table ─── */}
      <div className="panel" style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
          <strong style={{ fontSize: 13 }}>Videos ({filtered.length})</strong>
          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value)}
            style={{ marginLeft: "auto", padding: "4px 8px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 12 }}
          >
            <option value="all">All pipelines</option>
            {PIPELINES.map((p) => (
              <option key={p} value={p}>{PIPELINE_LABEL[p]}</option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={load} disabled={loading}>↻</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#6e6e73" }}>
              {th("Title")}
              {th("Pipeline")}
              {th("Published", "publishedAt")}
              {th("Views", "views")}
              {th("+7d", "views7d")}
              {th("Retention", "avgViewPct")}
              {th("Avg Watch")}
              {th("Likes")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.videoId} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px 6px 0", maxWidth: 280 }}>
                  <a
                    href={`https://youtu.be/${v.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#0a84ff", textDecoration: "none" }}
                  >
                    {v.title.length > 60 ? `${v.title.slice(0, 60)}…` : v.title}
                  </a>
                </td>
                <td>
                  <select
                    value={v.pipeline}
                    disabled={reassignBusy === v.videoId}
                    onChange={(e) => reassign(v.videoId, e.target.value)}
                    style={{ padding: "2px 4px", border: "1px solid #e5e5ea", borderRadius: 6, fontSize: 11 }}
                  >
                    {PIPELINES.map((p) => (
                      <option key={p} value={p}>{PIPELINE_LABEL[p]}</option>
                    ))}
                  </select>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{shortDate(v.publishedAt)}</td>
                <td>{n(v.views)}</td>
                <td style={{ color: (v.views7d ?? 0) > 0 ? "#34a853" : "#6e6e73" }}>
                  {v.views7d == null ? "—" : `+${n(v.views7d)}`}
                </td>
                <td>{pct(v.avgViewPct)}</td>
                <td>
                  {v.avgViewDurationSec == null ? "n/a" : `${Math.round(v.avgViewDurationSec)}s`}
                </td>
                <td>{n(v.likes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
