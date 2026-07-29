"use client";

import { useCallback, useEffect, useState } from "react";

// Posts tab — did every automated channel actually fire?
//
// Two halves, and the top one matters more: HEALTH is computed from the
// declared cadence in lib/post-schedule.ts, so a channel that stopped posting
// turns red on its own. The run feed below only ever shows what did happen,
// which is precisely how Instagram stayed silently broken for 4 days in July.

interface ChannelEntry {
  id: string;
  channel: string;
  account: string | null;
  status: string;
  url: string | null;
  error: string | null;
  costCents: number;
}

interface RunRow {
  runId: string;
  job: string;
  title: string | null;
  firedAt: string;
  costCents: number;
  channels: ChannelEntry[];
}

interface HealthRow {
  job: string;
  jobLabel: string;
  channel: string;
  account?: string;
  business?: string;
  schedule: string;
  unit: string;
  status: "ok" | "failing" | "dark" | "never";
  lastFiredAt: string | null;
  lastUrl: string | null;
  lastError: string | null;
  hoursSince: number | null;
}

interface Payload {
  days: number;
  runs: RunRow[];
  health: HealthRow[];
  summary: {
    posts: number;
    ok: number;
    failed: number;
    skipped: number;
    costCents: number;
    costByChannel: Record<string, number>;
    problems: number;
    declaredChannels: number;
  };
}

const CHANNEL_LABEL: Record<string, string> = {
  yt: "YouTube", fb: "Facebook", ig: "Instagram", pin: "Pinterest",
  tt: "TikTok", bsky: "Bluesky", threads: "Threads", x: "X",
  marketplace: "Marketplace", craigslist: "Craigslist",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ok: { bg: "#e8f8ee", fg: "#0a7d32", label: "OK" },
  failing: { bg: "#fdecea", fg: "#b3261e", label: "FAILING" },
  dark: { bg: "#fdecea", fg: "#b3261e", label: "DARK" },
  never: { bg: "#fff4e5", fg: "#8a5300", label: "NEVER RAN" },
};

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function HqPosts() {
  const [data, setData] = useState<Payload | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hq/post-log?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Payload);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <div style={{ padding: 20, color: "#6e6e73" }}>Loading post ledger…</div>;
  if (error) return <div style={{ padding: 20, color: "#b3261e" }}>Error: {error}</div>;
  if (!data) return null;

  const problems = data.health.filter((h) => h.status !== "ok");
  const healthy = data.health.filter((h) => h.status === "ok");

  return (
    <div style={{ padding: "4px 0 40px" }}>
      {/* ── Headline: is anything dark right now? ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          padding: "14px 16px", borderRadius: 12, marginBottom: 18,
          background: problems.length ? "#fdecea" : "#e8f8ee",
          border: `1px solid ${problems.length ? "#f5c2bd" : "#b7e4c7"}`,
        }}
      >
        <span style={{ fontSize: 22 }}>{problems.length ? "🔴" : "🟢"}</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: problems.length ? "#b3261e" : "#0a7d32" }}>
            {problems.length
              ? `${problems.length} of ${data.summary.declaredChannels} channels need attention`
              : `All ${data.summary.declaredChannels} channels posting on schedule`}
          </div>
          <div style={{ fontSize: 12, color: "#6e6e73", marginTop: 2 }}>
            Last {data.days}d — {data.summary.ok} posted · {data.summary.failed} failed ·{" "}
            {data.summary.skipped} skipped · {money(data.summary.costCents)} spent
          </div>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{ padding: "5px 10px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff" }}
        >
          <option value={1}>Today</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
        <button
          onClick={() => void load()}
          style={{ padding: "5px 12px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {/* ── Channel health, problems first ── */}
      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "#6e6e73", margin: "0 0 10px" }}>
        Channel health
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 26 }}>
        {[...problems, ...healthy].map((h) => {
          const s = STATUS_STYLE[h.status];
          return (
            <div
              key={`${h.job}-${h.channel}`}
              style={{ border: "1px solid #e5e5ea", borderRadius: 10, padding: "10px 12px", background: "#fff" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {CHANNEL_LABEL[h.channel] ?? h.channel}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: s.bg, color: s.fg }}>
                  {s.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#6e6e73" }}>
                {h.jobLabel} · {h.schedule}
              </div>
              {h.account && (
                <div style={{ fontSize: 11, color: "#6e6e73" }}>@{h.account}</div>
              )}
              <div style={{ fontSize: 11, marginTop: 5, color: h.status === "ok" ? "#0a7d32" : "#b3261e", fontWeight: 600 }}>
                {h.lastFiredAt ? `Last fired ${ago(h.lastFiredAt)}` : `No post ever recorded — ${h.unit}`}
              </div>
              {h.lastError && (
                <div style={{ fontSize: 11, color: "#b3261e", marginTop: 3 }}>{h.lastError.slice(0, 140)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cost breakdown ── */}
      {Object.keys(data.summary.costByChannel).length > 0 && (
        <>
          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "#6e6e73", margin: "0 0 10px" }}>
            Cost — last {data.days}d
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
            {Object.entries(data.summary.costByChannel)
              .sort((a, b) => b[1] - a[1])
              .map(([ch, cents]) => (
                <div key={ch} style={{ border: "1px solid #e5e5ea", borderRadius: 10, padding: "8px 14px", background: "#fff" }}>
                  <div style={{ fontSize: 11, color: "#6e6e73" }}>{CHANNEL_LABEL[ch] ?? ch}</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{money(cents)}</div>
                  <div style={{ fontSize: 10, color: "#6e6e73" }}>
                    ≈ {money(Math.round((cents / data.days) * 30))}/mo
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ── Run feed ── */}
      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "#6e6e73", margin: "0 0 10px" }}>
        Every post — last {data.days}d
      </h3>
      {data.runs.length === 0 ? (
        <div style={{ padding: 16, color: "#6e6e73", fontSize: 13, border: "1px dashed #d1d1d6", borderRadius: 10 }}>
          No posts recorded in this window.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.runs.map((run) => (
            <div key={run.runId} style={{ border: "1px solid #e5e5ea", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6e6e73", minWidth: 68 }}>
                  {clock(run.firedAt)}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 180 }}>
                  {run.title ?? run.job}
                </span>
                {run.costCents > 0 && (
                  <span style={{ fontSize: 12, color: "#6e6e73" }}>{money(run.costCents)}</span>
                )}
                <span style={{ fontSize: 11, color: "#8e8e93" }}>{ago(run.firedAt)}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {run.channels.map((c) => {
                  const ok = c.status === "ok";
                  const skipped = c.status === "skipped";
                  const bg = ok ? "#e8f8ee" : skipped ? "#f2f2f7" : "#fdecea";
                  const fg = ok ? "#0a7d32" : skipped ? "#6e6e73" : "#b3261e";
                  const chip = (
                    <span
                      style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color: fg, whiteSpace: "nowrap" }}
                      title={c.error ?? c.url ?? ""}
                    >
                      {ok ? "✓" : skipped ? "–" : "✕"} {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                  );
                  return c.url ? (
                    <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      {chip}
                    </a>
                  ) : (
                    <span key={c.id}>{chip}</span>
                  );
                })}
              </div>
              {run.channels.some((c) => c.status === "fail") && (
                <div style={{ fontSize: 11, color: "#b3261e", marginTop: 6 }}>
                  {run.channels
                    .filter((c) => c.status === "fail" && c.error)
                    .map((c) => `${CHANNEL_LABEL[c.channel] ?? c.channel}: ${c.error?.slice(0, 120)}`)
                    .join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
