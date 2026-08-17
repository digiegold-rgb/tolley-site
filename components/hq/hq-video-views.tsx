"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HqShowMore, HQ_PAGE_SIZE } from "./hq-show-more";
import { PLATFORM_BADGE, FALLBACK_BADGE } from "./hq-view-counter";

// Every tracked video, one row each, with its own view count.
//
// The counter above answers "how is the channel doing". This answers "which
// video worked" — the only question that changes what gets made next. It is
// also the ONLY honest read on Facebook reels: Meta's page_video_views metric
// doesn't count Reels-feed distribution, so a reels-first Page (Jelly Studio)
// shows ~1/5 of its real views in Page insights. These numbers come per-reel
// straight off the Graph API.

interface VideoRow {
  id: string;
  channelKey: string;
  channelLabel: string;
  platform: string;
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
  url: string | null;
  pulledAt: string;
}

interface ChannelRollup {
  key: string;
  label: string;
  platform: string;
  videos: number;
  views: number;
}

interface Payload {
  updatedAt: string | null;
  totalViews: number;
  videos: VideoRow[];
  channels: ChannelRollup[];
}

type Sort = "recent" | "top";

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

export function HqVideoViews() {
  const [data, setData] = useState<Payload | null>(null);
  const [channel, setChannel] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(HQ_PAGE_SIZE);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/video-views");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Payload);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A new filter or ordering is a new list — start it back at one page.
  useEffect(() => {
    setLimit(HQ_PAGE_SIZE);
  }, [channel, sort]);

  const rows = useMemo(() => {
    if (!data) return [];
    const filtered = channel === "all" ? data.videos : data.videos.filter((v) => v.channelKey === channel);
    return [...filtered].sort((a, b) =>
      sort === "top" ? b.views - a.views : Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    );
  }, [data, channel, sort]);

  if (error) {
    return (
      <div style={{ padding: "12px 16px", marginBottom: 26, borderRadius: 12, background: "#fdecea", color: "var(--hq-red)", fontSize: 13 }}>
        Video views: {error}
      </div>
    );
  }
  // Renders nothing until the collector has pushed per-video rows — an empty
  // shell here would read as "no videos exist", which is a different claim.
  if (!data || data.videos.length === 0) return null;

  const shownViews = rows.reduce((s, v) => s + v.views, 0);

  return (
    <div style={{ marginBottom: 26 }}>
      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--hq-ink-2)", margin: "0 0 10px" }}>
        Every video — views
      </h3>

      {/* ── Filter + sort bar ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {[{ key: "all", label: "All channels", views: data.totalViews, videos: data.videos.length }, ...data.channels].map((c) => {
          const active = channel === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setChannel(c.key)}
              style={{
                padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${active ? "#101014" : "var(--hq-border)"}`,
                background: active ? "#101014" : "#fff",
                color: active ? "#fff" : "var(--hq-ink-2)",
              }}
            >
              {c.label}{" "}
              <span style={{ fontWeight: 600, opacity: 0.7 }}>{c.views.toLocaleString()}</span>
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        {(["recent", "top"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            style={{
              padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${sort === s ? "#101014" : "var(--hq-border)"}`,
              background: sort === s ? "#101014" : "#fff",
              color: sort === s ? "#fff" : "var(--hq-ink-2)",
            }}
          >
            {s === "recent" ? "Newest" : "Most viewed"}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--hq-ink-2)", marginBottom: 10 }}>
        {rows.length.toLocaleString()} video{rows.length === 1 ? "" : "s"} ·{" "}
        <strong style={{ color: "#3c3c43" }}>{shownViews.toLocaleString()} views</strong>
        {data.updatedAt ? ` · counts pulled ${ago(data.updatedAt)}` : ""}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.slice(0, limit).map((v) => {
          const badge = PLATFORM_BADGE[v.platform] ?? FALLBACK_BADGE;
          const body = (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                border: `1px solid ${badge.cardBorder}`, borderRadius: 10,
                padding: "9px 12px", background: badge.cardBg,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: badge.bg, color: badge.fg, whiteSpace: "nowrap" }}>
                {badge.label}
              </span>
              <span
                style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={v.title}
              >
                {v.title}
              </span>
              <span style={{ fontSize: 11, color: "var(--hq-ink-3)", whiteSpace: "nowrap" }}>
                {v.channelLabel} · {ago(v.publishedAt)}
              </span>
              <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", minWidth: 74, textAlign: "right" }}>
                {v.views.toLocaleString()}
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--hq-ink-3)", marginLeft: 4 }}>views</span>
              </span>
            </div>
          );
          return v.url ? (
            <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
              {body}
            </a>
          ) : (
            <div key={v.id}>{body}</div>
          );
        })}
        <HqShowMore
          shown={Math.min(limit, rows.length)}
          total={rows.length}
          noun="videos"
          onMore={() => setLimit((n) => n + HQ_PAGE_SIZE)}
          onAll={() => setLimit(rows.length)}
        />
      </div>
    </div>
  );
}
