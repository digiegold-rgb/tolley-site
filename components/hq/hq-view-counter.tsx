"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Live view counter — the "subscriber counter" for the whole empire.
// One big odometer (total views across every channel for the picked window)
// over per-channel cards with views + subscriber/follower deltas. Data lands
// hourly from the DGX collector; this just re-reads every 2 minutes.

interface WindowStat { views: number | null; partial: boolean; since: string | null }

interface Channel {
  key: string;
  platform: "youtube" | "facebook" | "tiktok";
  label: string;
  note: string | null;
  url: string;
  lifetimeViews: number | null;
  subscribers: number | null;
  subDelta1d: number | null;
  subDelta7d: number | null;
  windows: Record<string, WindowStat>;
  lastPulledAt: string | null;
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

const PLATFORM_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  youtube: { label: "▶ YouTube", bg: "#fdecea", fg: "#c4302b" },
  facebook: { label: "ⓕ Facebook", bg: "#e7f0fd", fg: "#1877f2" },
  tiktok: { label: "♪ TikTok", bg: "#e6fafa", fg: "#0d8a84" },
};

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

function SubDelta({ delta, period }: { delta: number | null; period: string }) {
  if (delta === null) return null;
  const color = delta > 0 ? "#0a7d32" : delta < 0 ? "#b3261e" : "#8e8e93";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return (
    <span style={{ color, fontWeight: 700 }}>
      {arrow} {Math.abs(delta).toLocaleString()} {period}
    </span>
  );
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
      <div style={{ padding: "12px 16px", marginBottom: 18, borderRadius: 12, background: "#fdecea", color: "#b3261e", fontSize: 13 }}>
        View counter: {error}
      </div>
    );
  }
  if (!data) return null;

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
          const badge = PLATFORM_BADGE[c.platform];
          return (
            <a
              key={c.key}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: "1px solid #e5e5ea", borderRadius: 12, padding: "12px 14px",
                background: "#fff", textDecoration: "none", color: "inherit", display: "block",
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
              {c.note && <div style={{ fontSize: 10, color: "#8e8e93", marginBottom: 6 }}>{c.note}</div>}
              <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                {v.views !== null ? v.views.toLocaleString() : "—"}
                <span style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginLeft: 6 }}>views</span>
              </div>
              {v.since && (
                <div style={{ fontSize: 10, color: "#8a5300", marginTop: 2 }}>since {v.since}</div>
              )}
              <div style={{ fontSize: 12, color: "#3c3c43", marginTop: 8, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {c.subscribers !== null ? c.subscribers.toLocaleString() : "—"}
                </span>
                <span style={{ fontSize: 10, color: "#8e8e93" }}>
                  {c.platform === "youtube" ? "subs" : "followers"}
                </span>
                <SubDelta delta={c.subDelta7d ?? c.subDelta1d} period={c.subDelta7d !== null ? "7d" : "1d"} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
