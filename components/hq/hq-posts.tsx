"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { isHttpUrl } from "./types";
import { HqShowMore, HQ_PAGE_SIZE } from "./hq-show-more";
import { HqVideoCosts } from "./hq-video-costs";
import { HqVideoFootprint } from "./hq-video-footprint";
import { HqViewCounter } from "./hq-view-counter";
import { HqVideoViews } from "./hq-video-views";
import { HqAdsStatus } from "./hq-ads-status";
import HqCityRanks from "./hq-city-ranks";

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
  renderCents?: number;
  renderEstimated?: boolean;
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
  ok: { bg: "#e8f8ee", fg: "var(--hq-green)", label: "OK" },
  failing: { bg: "#fdecea", fg: "var(--hq-red)", label: "FAILING" },
  dark: { bg: "#fdecea", fg: "var(--hq-red)", label: "DARK" },
  never: { bg: "#fff4e5", fg: "var(--hq-amber)", label: "NEVER RAN" },
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

// One-liner pushed hourly by the DGX (dgx-activity-scan.sh): what the box is
// actively working on right now. Renders nothing until the first push lands.
function DgxActivityLine() {
  const { toast } = useToast();
  const [act, setAct] = useState<{ line: string; updatedAt: string } | null>(null);

  // "No line yet" and "the endpoint is down" both render as nothing, and a
  // missing DGX line is exactly the signal you'd want to notice — so say it.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/dgx-activity")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled && d?.line) setAct(d as { line: string; updatedAt: string });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toast({
          title: "DGX activity unavailable",
          description: e instanceof Error ? e.message : String(e),
          variant: "warning",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (!act) return null;
  const stale = Date.now() - Date.parse(act.updatedAt) > 2 * 3600_000;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 16px", borderRadius: 10, marginBottom: 10,
        background: "#f2f2f7", border: "1px solid var(--hq-line)",
      }}
    >
      <span style={{ fontSize: 15 }}>🖥️</span>
      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 200 }}>
        DGX: {act.line}
      </span>
      <span style={{ fontSize: 11, color: stale ? "var(--hq-red)" : "var(--hq-ink-3)", fontWeight: stale ? 700 : 400 }}>
        {stale ? `⚠︎ scan stale — ${ago(act.updatedAt)}` : ago(act.updatedAt)}
      </span>
    </div>
  );
}

export function HqPosts() {
  const [data, setData] = useState<Payload | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runLimit, setRunLimit] = useState(HQ_PAGE_SIZE);

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

  // A new day-range is a new list — start it back at one page.
  useEffect(() => {
    setRunLimit(HQ_PAGE_SIZE);
  }, [days]);

  if (loading && !data) return <div style={{ padding: 20, color: "var(--hq-ink-2)" }}>Loading post ledger…</div>;
  if (error) return <div style={{ padding: 20, color: "var(--hq-red)" }}>Error: {error}</div>;
  if (!data) return null;

  const problems = data.health.filter((h) => h.status !== "ok");
  const healthy = data.health.filter((h) => h.status === "ok");

  return (
    <div style={{ padding: "4px 0 40px" }}>
      {/* ── What the DGX is actively working on (hourly scan) — sits above
           the view-counter bar on purpose: first thing Jared sees. ── */}
      <DgxActivityLine />

      {/* ── Paid ads (read-only). Jared: after the DGX strip, before every-video. ── */}
      <HqAdsStatus />

      {/* ── Live view counter across every channel ── */}
      <HqViewCounter />

      {/* ── Every individual video and what it got. Sits right under the
           channel cards because it's the same question one level down: the
           cards say a channel is up, this says which video did it. Also the
           only place FB reel views are visible — Meta's Page insights don't
           count Reels-feed distribution at all. ── */}
      <HqVideoViews />

      {/* ── Monthly city search-rank sweep (renders after first sweep) ── */}
      <HqCityRanks />

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
          <div style={{ fontWeight: 700, fontSize: 15, color: problems.length ? "var(--hq-red)" : "var(--hq-green)" }}>
            {problems.length
              ? `${problems.length} of ${data.summary.declaredChannels} channels need attention`
              : `All ${data.summary.declaredChannels} channels posting on schedule`}
          </div>
          <div style={{ fontSize: 12, color: "var(--hq-ink-2)", marginTop: 2 }}>
            Last {data.days}d — {data.summary.ok} posted · {data.summary.failed} failed ·{" "}
            {data.summary.skipped} skipped · {money(data.summary.costCents)} spent
          </div>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{ padding: "5px 10px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff" }}
        >
          <option value={1}>Today</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
        <button
          onClick={() => void load()}
          style={{ padding: "5px 12px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {/* ── What the videos cost (all-time, unpruned — see hq-video-costs) ── */}
      <HqVideoCosts />

      {/* ── What they occupy on disk, and what self-hosting saves. Sits after
           spend on purpose: it reconciles the same renders from the other side,
           counting what never reached the ledger at all. ── */}
      <HqVideoFootprint />

      {/* ── Channel health, problems first ── */}
      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--hq-ink-2)", margin: "0 0 10px" }}>
        Channel health
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 26 }}>
        {[...problems, ...healthy].map((h) => {
          const s = STATUS_STYLE[h.status];
          return (
            <div
              key={`${h.job}-${h.channel}`}
              style={{ border: "1px solid var(--hq-line)", borderRadius: 10, padding: "10px 12px", background: "#fff" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {CHANNEL_LABEL[h.channel] ?? h.channel}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: s.bg, color: s.fg }}>
                  {s.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>
                {h.jobLabel} · {h.schedule}
              </div>
              {h.account && (
                <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>@{h.account}</div>
              )}
              <div style={{ fontSize: 11, marginTop: 5, color: h.status === "ok" ? "var(--hq-green)" : "var(--hq-red)", fontWeight: 600 }}>
                {h.lastFiredAt ? `Last fired ${ago(h.lastFiredAt)}` : `No post ever recorded — ${h.unit}`}
              </div>
              {h.lastError && (
                <div style={{ fontSize: 11, color: "var(--hq-red)", marginTop: 3 }}>{h.lastError.slice(0, 140)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cost breakdown ── */}
      {Object.keys(data.summary.costByChannel).length > 0 && (
        <>
          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--hq-ink-2)", margin: "0 0 10px" }}>
            Cost — last {data.days}d
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
            {Object.entries(data.summary.costByChannel)
              .sort((a, b) => b[1] - a[1])
              .map(([ch, cents]) => (
                <div key={ch} style={{ border: "1px solid var(--hq-line)", borderRadius: 10, padding: "8px 14px", background: "#fff" }}>
                  <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>{CHANNEL_LABEL[ch] ?? ch}</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{money(cents)}</div>
                  <div style={{ fontSize: 10, color: "var(--hq-ink-2)" }}>
                    ≈ {money(Math.round((cents / data.days) * 30))}/mo
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ── Run feed ── */}
      <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--hq-ink-2)", margin: "0 0 10px" }}>
        Every post — last {data.days}d
      </h3>
      {data.runs.length === 0 ? (
        <div style={{ padding: 16, color: "var(--hq-ink-2)", fontSize: 13, border: "1px dashed var(--hq-border)", borderRadius: 10 }}>
          No posts recorded in this window.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.runs.slice(0, runLimit).map((run) => (
            <div key={run.runId} style={{ border: "1px solid var(--hq-line)", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--hq-ink-2)", minWidth: 68 }}>
                  {clock(run.firedAt)}
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 180 }}>
                  {run.title ?? run.job}
                </span>
                {(run.renderCents ?? 0) > 0 && (
                  <span style={{ fontSize: 12, color: "var(--hq-ink-2)" }} title="What the video cost to make (VideoCost ledger)">
                    render {run.renderEstimated ? "~" : ""}{money(run.renderCents!)}
                  </span>
                )}
                {run.costCents > 0 && (
                  <span style={{ fontSize: 12, color: "var(--hq-ink-2)" }} title="Posting API spend">posting {money(run.costCents)}</span>
                )}
                <span style={{ fontSize: 11, color: "var(--hq-ink-3)" }}>{ago(run.firedAt)}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {run.channels.map((c) => {
                  const ok = c.status === "ok";
                  const skipped = c.status === "skipped";
                  const bg = ok ? "#e8f8ee" : skipped ? "#f2f2f7" : "#fdecea";
                  const fg = ok ? "var(--hq-green)" : skipped ? "var(--hq-ink-2)" : "var(--hq-red)";
                  const chip = (
                    <span
                      style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color: fg, whiteSpace: "nowrap" }}
                      title={c.error ?? c.url ?? ""}
                    >
                      {ok ? "✓" : skipped ? "–" : "✕"} {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                  );
                  // Post URLs come back from a dozen different posters; only
                  // link the ones that are actually http(s).
                  return isHttpUrl(c.url) ? (
                    <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      {chip}
                    </a>
                  ) : (
                    <span key={c.id}>{chip}</span>
                  );
                })}
              </div>
              {run.channels.some((c) => c.status === "fail") && (
                <div style={{ fontSize: 11, color: "var(--hq-red)", marginTop: 6 }}>
                  {run.channels
                    .filter((c) => c.status === "fail" && c.error)
                    .map((c) => `${CHANNEL_LABEL[c.channel] ?? c.channel}: ${c.error?.slice(0, 120)}`)
                    .join(" · ")}
                </div>
              )}
            </div>
          ))}
          <HqShowMore
            shown={Math.min(runLimit, data.runs.length)}
            total={data.runs.length}
            noun="runs"
            onMore={() => setRunLimit((n) => n + HQ_PAGE_SIZE)}
            onAll={() => setRunLimit(data.runs.length)}
          />
        </div>
      )}
    </div>
  );
}
