"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Live view counter — the "subscriber counter" for the whole empire.
// One big odometer (total views across every channel for the picked window)
// over per-channel cards with views + subscriber/follower deltas. Data lands
// hourly from the DGX collector; this just re-reads every 2 minutes.

interface WindowStat { views: number | null; partial: boolean; since: string | null }

interface Channel {
  key: string;
  platform: "youtube" | "facebook" | "tiktok" | "x" | "bluesky" | "linkedin" | "pinterest";
  label: string;
  note: string | null;
  url: string;
  lifetimeViews: number | null;
  subscribers: number | null;
  subDelta1d: number | null;
  subDelta7d: number | null;
  subRounding: number;
  windows: Record<string, WindowStat>;
  viewsThrough: string | null;
  live: LiveStat | null;
  lastPulledAt: string | null;
}

/** Near-realtime counts on recent uploads — bypasses YouTube's ~3d Analytics lag. */
interface LiveStat {
  h24: { views: number; videos: number };
  d7: { views: number; videos: number };
  topTitle: string | null;
  topViews: number | null;
  topVideoId: string | null;
  asOf: string;
}

interface Payload {
  updatedAt: string | null;
  totals: Record<string, { views: number; partial: boolean }>;
  channels: Channel[];
}

type WindowKey = "d30" | "d90" | "d365" | "lifetime";

const WINDOW_LABELS: Record<WindowKey, string> = {
  d30: "30 days",
  d90: "90 days",
  d365: "1 year",
  lifetime: "All-time",
};

// cardBg/cardBorder tint the whole card so platforms read as groups at a
// glance even after the views-sort interleaves them.
export const PLATFORM_BADGE: Record<string, { label: string; bg: string; fg: string; cardBg: string; cardBorder: string }> = {
  youtube: { label: "▶ YouTube", bg: "#fdecea", fg: "#c4302b", cardBg: "#fff6f5", cardBorder: "#f5dcd9" },
  facebook: { label: "ⓕ Facebook", bg: "#e7f0fd", fg: "#1877f2", cardBg: "#f3f7fe", cardBorder: "#d9e6fa" },
  tiktok: { label: "♪ TikTok", bg: "#e6fafa", fg: "#0d8a84", cardBg: "#f0fbfa", cardBorder: "#d2efec" },
  x: { label: "𝕏", bg: "#e9e9ee", fg: "#0f1419", cardBg: "#f6f6f8", cardBorder: "#e0e0e6" },
  bluesky: { label: "🦋 Bluesky", bg: "#e3f3fe", fg: "#1185fe", cardBg: "#eefaff", cardBorder: "#cfeafb" },
  linkedin: { label: "in LinkedIn", bg: "#e2edfb", fg: "#0a66c2", cardBg: "#f1f6fd", cardBorder: "#d3e3f7" },
  pinterest: { label: "P Pinterest", bg: "#fce8e9", fg: "#e60023", cardBg: "#fef4f5", cardBorder: "#f7d6d9" },
};
export const FALLBACK_BADGE = { label: "•", bg: "#eee", fg: "#333", cardBg: "#fff", cardBorder: "var(--hq-line)" };

/** One rolling digit column, 0–9 stacked; translateY slides to the value. */
function Digit({ d, height }: { d: number; height: number }) {
  return (
    <span
      style={{
        display: "inline-block", height, overflow: "hidden",
        verticalAlign: "top",
      }}
    >
      <span
        style={{
          display: "block",
          transform: `translateY(${-d * height}px)`,
          transition: "transform 900ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} style={{ display: "block", height, lineHeight: `${height}px` }}>{n}</span>
        ))}
      </span>
    </span>
  );
}

/** Odometer: digits roll, separators stay put. */
function Odometer({ value, size }: { value: number; size: number }) {
  const text = Math.max(0, Math.round(value)).toLocaleString("en-US");
  const height = Math.round(size * 1.15);
  return (
    <span
      style={{
        fontSize: size, fontWeight: 800, fontVariantNumeric: "tabular-nums",
        letterSpacing: 1, display: "inline-flex", alignItems: "flex-start",
      }}
    >
      {text.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <Digit key={`${text.length}-${i}`} d={Number(ch)} height={height} />
        ) : (
          <span key={`${text.length}-${i}`} style={{ height, lineHeight: `${height}px` }}>{ch}</span>
        ),
      )}
    </span>
  );
}

function SubDelta({ delta, period, rounding = 1 }: { delta: number | null; period: string; rounding?: number }) {
  if (delta === null) return null;
  // A swing no bigger than the platform's own reporting granularity carries no
  // information — showing it in alarm-red invites chasing churn that never
  // happened. Render it grey and labelled as rounding instead.
  if (rounding > 1 && Math.abs(delta) <= rounding) {
    return (
      <span style={{ color: "var(--hq-ink-3)", fontWeight: 600 }}>
        ±{rounding.toLocaleString()} rounding
      </span>
    );
  }
  const color = delta > 0 ? "var(--hq-green)" : delta < 0 ? "var(--hq-red)" : "var(--hq-ink-3)";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return (
    <span style={{ color, fontWeight: 700 }}>
      {arrow} {Math.abs(delta).toLocaleString()} {period}
    </span>
  );
}

/**
 * The un-lagged half of the card. The big number above it is YouTube Analytics
 * and runs ~3 days behind; this is per-video counts pulled hourly, so a Short
 * posted this morning shows up here immediately. Labelled "on new uploads"
 * because it counts views on recent videos, not all views received recently.
 */
function LiveStrip({ live }: { live: LiveStat }) {
  const { h24, d7 } = live;
  return (
    <div
      style={{
        marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--hq-line)",
        fontSize: 11, color: "#3c3c43", lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 0.4, padding: "1px 5px",
            borderRadius: 4, background: "#e8f8ee", color: "var(--hq-green)", whiteSpace: "nowrap",
          }}
        >
          ● LIVE
        </span>
        <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
          {h24.views.toLocaleString()}
        </span>
        <span style={{ color: "var(--hq-ink-3)" }}>
          on {h24.videos} upload{h24.videos === 1 ? "" : "s"} · 24h
        </span>
      </div>
      <div style={{ color: "var(--hq-ink-3)", marginTop: 2 }}>
        7d uploads: <strong style={{ color: "#3c3c43" }}>{d7.views.toLocaleString()}</strong> on{" "}
        {d7.videos} video{d7.videos === 1 ? "" : "s"}
      </div>
      {live.topTitle && live.topViews !== null && (
        <div
          style={{
            color: "var(--hq-ink-3)", marginTop: 2, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          title={live.topTitle}
        >
          top: {live.topViews.toLocaleString()} — {live.topTitle}
        </div>
      )}
    </div>
  );
}

/** Whole days between an ISO date (UTC midnight) and today, or null. */
function daysBehind(isoDay: string | null): number | null {
  if (!isoDay) return null;
  const then = Date.parse(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((todayUtc - then) / 86400000));
}

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

export function HqViewCounter() {
  const [data, setData] = useState<Payload | null>(null);
  const [win, setWin] = useState<WindowKey>("d30");
  const [error, setError] = useState("");
  // First paint shows 0s so the odometer visibly rolls up to the real number.
  const [warm, setWarm] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/view-counter");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Payload;
      if (!mounted.current) return;
      setData(json);
      setError("");
      requestAnimationFrame(() => requestAnimationFrame(() => setWarm(true)));
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const t = setInterval(() => void load(), 120_000);
    return () => { mounted.current = false; clearInterval(t); };
  }, [load]);

  if (error) {
    return (
      <div style={{ padding: "12px 16px", marginBottom: 18, borderRadius: 12, background: "#fdecea", color: "var(--hq-red)", fontSize: 13 }}>
        View counter: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: "12px 16px", marginBottom: 18, borderRadius: 12, background: "#f2f2f7", color: "var(--hq-ink-3)", fontSize: 13 }}>
        Loading view counter…
      </div>
    );
  }

  const channelViews = (c: Channel): { views: number | null; partial: boolean; since: string | null } => {
    if (win === "lifetime") {
      return { views: c.lifetimeViews, partial: c.platform === "facebook", since: null };
    }
    const w = c.windows[win];
    return { views: w?.views ?? null, partial: w?.partial ?? false, since: w?.since ?? null };
  };

  const total = win === "lifetime" ? data.totals.lifetime : data.totals[win];
  const shown = warm ? total?.views ?? 0 : 0;
  const anyPartial = total?.partial ?? false;

  const sorted = [...data.channels].sort(
    (a, b) => (channelViews(b).views ?? -1) - (channelViews(a).views ?? -1),
  );

  return (
    <div style={{ marginBottom: 26 }}>
      {/* ── The big counter ── */}
      <div
        style={{
          borderRadius: 16, padding: "26px 24px 22px", marginBottom: 12,
          background: "linear-gradient(135deg, #101014 0%, #1c1c22 60%, #24242c 100%)",
          color: "#fff", textAlign: "center", position: "relative", overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#9a9aa2", marginBottom: 10 }}>
          Total views — all channels · {WINDOW_LABELS[win]}
          {anyPartial ? " †" : ""}
        </div>
        <Odometer value={shown} size={54} />
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setWin(k)}
              style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                cursor: "pointer", transition: "all 150ms",
                border: win === k ? "1px solid #fff" : "1px solid #3a3a44",
                background: win === k ? "#fff" : "transparent",
                color: win === k ? "#101014" : "#c7c7cf",
              }}
            >
              {WINDOW_LABELS[k]}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "#6e6e78" }}>
          {data.updatedAt ? `updated ${ago(data.updatedAt)} · refreshes hourly` : "waiting for first collection…"}
          {anyPartial && " · † some channels tracked from a later start date"}
        </div>
      </div>

      {/* ── Per-channel cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {sorted.map((c) => {
          const v = channelViews(c);
          const badge = PLATFORM_BADGE[c.platform] ?? FALLBACK_BADGE;
          return (
            <a
              key={c.key}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: `1px solid ${badge.cardBorder}`, borderRadius: 12, padding: "12px 14px",
                background: badge.cardBg, textDecoration: "none", color: "inherit", display: "block",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: badge.bg, color: badge.fg, whiteSpace: "nowrap" }}>
                  {badge.label}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.label}
                </span>
              </div>
              {c.note && <div style={{ fontSize: 10, color: "var(--hq-ink-3)", marginBottom: 6 }}>{c.note}</div>}
              {(() => {
                // Per-platform headline metric: Bluesky has no views (likes),
                // LinkedIn reports impressions, everything else is views.
                const metric =
                  c.platform === "bluesky" ? "likes"
                  : c.platform === "linkedin" || c.platform === "pinterest" ? "impressions"
                  : "views";
                // Day one of tracking a snapshot-based channel (TikTok/X): no
                // window delta exists yet, but lifetime does. A bare "—" reads
                // as broken — show the all-time number, honestly labeled,
                // until the first day-over-day delta lands.
                const fallback = v.views === null && c.lifetimeViews !== null;
                const shown = v.views ?? c.lifetimeViews;
                return (
                  <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                    {shown !== null ? shown.toLocaleString() : "—"}
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--hq-ink-3)", marginLeft: 6 }}>
                      {fallback ? `${metric} · all-time` : metric}
                    </span>
                  </div>
                );
              })()}
              {v.views === null && c.lifetimeViews !== null && (
                <div style={{ fontSize: 10, color: "var(--hq-amber)", marginTop: 2 }}>
                  {WINDOW_LABELS[win]} splits start after day 2 of tracking
                </div>
              )}
              {v.since && (
                <div style={{ fontSize: 10, color: "var(--hq-amber)", marginTop: 2 }}>since {v.since}</div>
              )}
              {(() => {
                const behind = daysBehind(c.viewsThrough);
                if (behind === null || behind < 2) return null;
                // YouTube Analytics and LinkedIn's digest genuinely publish
                // late — that IS platform lag. X and TikTok are scraped, and a
                // scrape only goes stale because it is FAILING (x-ykh has
                // returned nothing since 2026-08-13). Calling that "platform
                // lag" tells you to wait for a number that is never coming, so
                // name the two cases differently.
                const scraped = c.platform === "x" || c.platform === "tiktok";
                return (
                  <div style={{ fontSize: 10, color: scraped ? "var(--hq-red)" : "var(--hq-amber)", marginTop: 2 }}>
                    views through {c.viewsThrough} · {behind}d {scraped ? "stale — collector failing" : "platform lag"}
                  </div>
                );
              })()}
              {c.live && <LiveStrip live={c.live} />}
              <div style={{ fontSize: 12, color: "#3c3c43", marginTop: 8, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {c.subscribers !== null ? c.subscribers.toLocaleString() : "—"}
                </span>
                <span style={{ fontSize: 10, color: "var(--hq-ink-3)" }}>
                  {c.platform === "youtube" ? "subs" : "followers"}
                </span>
                <SubDelta
                  delta={c.subDelta7d ?? c.subDelta1d}
                  period={c.subDelta7d !== null ? "7d" : "1d"}
                  rounding={c.subRounding ?? 1}
                />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
