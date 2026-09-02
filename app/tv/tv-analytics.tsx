"use client";

import { useCallback, useEffect, useState } from "react";
import type { PipelineItem } from "@/lib/tv-analytics";
import {
  formatBytes,
  matchLiveRow,
  type LiveMatch,
  type StorageSummary,
  type TvStatsSnapshot,
} from "@/lib/tv-stats";

type Overview = {
  fetchedAt: string;
  overseerr: { ok: boolean; version: string | null; host?: string };
  nas: {
    wired: boolean;
    moviesMount?: string;
    tvMount?: string;
    note?: string;
  };
  counts: {
    total: number;
    movie: number;
    tv: number;
    pending: number;
    processing: number;
    available: number;
    declined: number;
    failed: number;
    downloading: number;
    needsRetry: number;
    failedOrAired: number;
    processingStuck: number;
    processingMoving: number;
    fourKDownloading: number;
    fourKFailed: number;
    hdFailed: number;
  };
  downloading: PipelineItem[];
  needsRetry: PipelineItem[];
  failed: PipelineItem[];
  available: PipelineItem[];
  error?: string;
};

type StatsPayload = {
  connected?: boolean;
  ok?: boolean;
  host?: string;
  ts?: string | null;
  error?: string;
  snapshot?: TvStatsSnapshot | null;
  storage?: StorageSummary | null;
};

const REFRESH_MS = 20_000;

const box: React.CSSProperties = {
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
};

function QualityBadge({ quality, mediaType }: { quality: "4k" | "hd"; mediaType: "movie" | "tv" }) {
  if (mediaType === "tv") {
    return (
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: 0.5,
          padding: "2px 6px",
          borderRadius: 5,
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.3)",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        HD
      </span>
    );
  }
  const is4k = quality === "4k";
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: 0.5,
        padding: "2px 6px",
        borderRadius: 5,
        flexShrink: 0,
        border: is4k ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.18)",
        background: is4k ? "rgba(139,92,246,0.25)" : "rgba(0,0,0,0.3)",
        color: is4k ? "#c4b5fd" : "rgba(255,255,255,0.55)",
      }}
    >
      {is4k ? "4K" : "HD"}
    </span>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 99,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
        }}
      />
    </div>
  );
}

function MotionBadge({ motion }: { motion: PipelineItem["motion"] }) {
  if (!motion) return null;
  const stuck = motion === "stuck";
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: 0.6,
        padding: "2px 6px",
        borderRadius: 5,
        flexShrink: 0,
        border: stuck ? "1px solid #f59e0b" : "1px solid rgba(56,189,248,0.45)",
        background: stuck ? "rgba(239,68,68,0.22)" : "rgba(56,189,248,0.16)",
        color: stuck ? "#fca5a5" : "#7dd3fc",
      }}
    >
      {stuck ? "STUCK" : "MOVING"}
    </span>
  );
}

function ItemRow({ m, live }: { m: PipelineItem; live: LiveMatch | null }) {
  const stuck = m.motion === "stuck";
  const pct = live?.percentDone ?? m.progress;
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        ...box,
        alignItems: "center",
        border: stuck ? "1px solid rgba(245,158,11,0.45)" : box.border,
        background: stuck ? "rgba(239,68,68,0.08)" : box.background,
      }}
    >
      {m.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={m.poster}
          alt=""
          style={{ width: 42, height: 63, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 42,
            height: 63,
            borderRadius: 8,
            background: "linear-gradient(135deg,#241a12,#15100c)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 18,
            opacity: 0.5,
          }}
        >
          {m.mediaType === "tv" ? "📺" : "🎬"}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {m.title}
          </div>
          <QualityBadge quality={m.quality} mediaType={m.mediaType} />
          <MotionBadge motion={m.motion} />
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
          {m.mediaType === "tv" ? "TV" : "Movie"}
          {m.year ? ` · ${m.year}` : ""}
          {m.profileId != null ? ` · profile ${m.profileId}` : ""}
          {m.downloadLabel ? ` · ${m.downloadLabel}` : ""}
          {m.timeLeft ? ` · ${m.timeLeft} left` : ""}
          {m.progress != null ? ` · ${m.progress}%` : ""}
          {live?.trackedDownloadState ? ` · ${live.trackedDownloadState}` : ""}
          {live?.percentDone != null ? ` · snap ${live.percentDone}%` : ""}
          {live?.eta ? ` · ${live.eta} eta` : ""}
          {live?.peersConnected != null ? ` · ${live.peersConnected} peers` : ""}
          {m.ageLabel ? ` · ${m.ageLabel}` : ""}
          {m.retriedLabel ? ` · ${m.retriedLabel}` : ""}
        </div>
        {pct != null && (
          <ProgressBar pct={pct} color={m.quality === "4k" ? "#a78bfa" : "#38bdf8"} />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  empty,
  items,
  snap,
}: {
  title: string;
  empty: string;
  items: PipelineItem[];
  snap: TvStatsSnapshot | null;
}) {
  return (
    <section>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "18px 0 8px", fontWeight: 700 }}>
        {title}
        {items.length ? ` · ${items.length}` : ""}
      </div>
      {items.length === 0 ? (
        <div style={{ ...box, padding: 16, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{empty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((m) => (
            <ItemRow key={`${m.mediaType}-${m.id}`} m={m} live={snap ? matchLiveRow(m.title, snap) : null} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ ...box, padding: "12px 14px", minWidth: 92, flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent || "white" }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StorageBar({ stats }: { stats: StatsPayload | null }) {
  if (!stats || !stats.connected || !stats.storage) {
    return (
      <div
        style={{
          ...box,
          padding: "14px 16px",
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(245,158,11,0.25)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14 }}>💾 NAS snapshot not connected</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          tv-stats.tolley.io did not answer. Overseerr lists still load. No Arr / Transmission / Plex keys on this site.
          {stats?.error ? ` (${stats.error})` : ""}
        </div>
      </div>
    );
  }
  const s = stats.storage;
  return (
    <div
      style={{
        ...box,
        padding: "14px 16px",
        background: "rgba(0,0,0,0.35)",
        border: s.staleNfs ? "1px solid rgba(245,158,11,0.55)" : "1px solid rgba(56,189,248,0.25)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14 }}>💾 NAS storage (read-only snapshot)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {s.volumes.map((v) => {
          const used =
            v.total != null && v.free != null && v.total > 0
              ? Math.max(0, Math.min(100, Math.round(((v.total - v.free) / v.total) * 100)))
              : null;
          return (
            <div key={v.key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.75)" }}>
                  {v.label}
                  {v.path ? <code style={{ marginLeft: 8, color: "rgba(255,255,255,0.45)" }}>{v.path}</code> : null}
                </span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>
                  {formatBytes(v.free)} free{v.total != null ? ` / ${formatBytes(v.total)}` : ""}
                </span>
              </div>
              {used != null && <ProgressBar pct={used} color={v.kind.startsWith("plex") ? "#f59e0b" : "#38bdf8"} />}
            </div>
          );
        })}
      </div>
      {s.staleNote && (
        <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 10 }}>{s.staleNote}</div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
        <span style={{ color: "#38bdf8" }}>tv-stats.tolley.io</span>
        <span>{s.torrentCount} torrents</span>
        <span>radarr {s.radarrCount}</span>
        <span>sonarr {s.sonarrCount}</span>
      </div>
    </div>
  );
}

export function TvAnalytics() {
  const [data, setData] = useState<Overview | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const analyticsP = fetch("/api/tv/analytics", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) {
          setError(j.error || `HTTP ${r.status}`);
          if (j.nas || j.overseerr) setData(j);
          return;
        }
        setError("");
        setData(j);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });

    const statsP = fetch("/api/tv/stats", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json()) as StatsPayload;
        if (!r.ok || j.connected === false) {
          setStats({ connected: false, error: j.error || `HTTP ${r.status}` });
          return;
        }
        setStats(j);
      })
      .catch(() => {
        setStats({ connected: false, error: "tv-stats unreachable" });
      });

    await Promise.all([analyticsP, statsP]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const snap = stats?.connected && stats.snapshot ? stats.snapshot : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <StorageBar stats={stats} />
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "8px 2px 0" }}>
        <span style={{ color: data?.overseerr?.ok ? "#38bdf8" : "rgba(255,255,255,0.4)" }}>
          {data?.overseerr?.ok
            ? `Overseerr${data.overseerr.version ? ` v${data.overseerr.version}` : ""} · tv-api.tolley.io`
            : "Overseerr (tv-api.tolley.io)"}
        </span>
        {" · "}
        Movies <code style={{ color: "rgba(255,255,255,0.65)" }}>/mnt/plex-movies</code>
        {" · "}
        TV <code style={{ color: "rgba(255,255,255,0.65)" }}>/mnt/plex-tv</code>
        . No Arr / Transmission / Plex keys on this site.
      </div>

      {loading && !data && (
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 16 }}>Loading Overseerr requests…</p>
      )}
      {error && (
        <p style={{ color: "#f87171", fontSize: 14, marginTop: 12 }}>⚠️ {error}</p>
      )}

      {data && !error && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <Stat label="Processing" value={data.counts.processing} accent="#38bdf8" />
            <Stat label="Moving" value={data.counts.processingMoving} accent="#38bdf8" />
            <Stat label="Stuck" value={data.counts.processingStuck} accent="#f59e0b" />
            <Stat label="Need retry" value={data.counts.needsRetry} accent="#f59e0b" />
            <Stat label="Failed / declined" value={data.counts.failedOrAired} accent="#f87171" />
            <Stat label="On Plex" value={data.counts.available} accent="#22c55e" />
            <Stat label="4K failed" value={data.counts.fourKFailed} accent="#c4b5fd" />
            <Stat label="HD failed" value={data.counts.hdFailed} />
          </div>

          <Section
            title="Stuck"
            empty="Nothing sitting in processing/waiting without a signal."
            items={data.downloading.filter((i) => i.motion === "stuck")}
            snap={snap}
          />
          <Section
            title="Moving"
            empty="Nothing actively transferring right now."
            items={data.downloading.filter((i) => i.motion === "moving")}
            snap={snap}
          />
          <Section
            title="Needs retry"
            empty="No failed grabs waiting on a retry."
            items={data.needsRetry}
            snap={snap}
          />
          <Section
            title="Failed / declined"
            empty="No declined or deleted requests."
            items={data.failed}
            snap={snap}
          />
          <Section
            title="Recently available"
            empty="No recently available titles in this window."
            items={data.available}
            snap={snap}
          />

          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 18 }}>
            Overseerr is tv-api.tolley.io. The storage snapshot is tv-stats.tolley.io. Live &amp; DVR is a third host.
            Refreshing every 20s. Request and DVR paths are unchanged.
          </p>
        </>
      )}
    </div>
  );
}
