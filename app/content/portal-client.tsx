"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Section =
  | "dashboard"
  | "connections"
  | "workflows"
  | "content"
  | "library"
  | "queue"
  | "agent"
  | "analytics"
  | "upload"
  | "logs"
  | "settings";

const SECTIONS: Section[] = [
  "dashboard", "connections", "workflows", "content", "library",
  "queue", "agent", "analytics", "upload", "logs", "settings",
];

interface StatusData {
  daemon_running: boolean;
  service_active: boolean;
  videos: { input: number; processing: number; output: number; total_processed: number };
  queue: { pending: number; posted: number; failed: number; total: number };
  enabled_platforms: string[];
  posting_order: { platform: string; delay_minutes: number }[];
}

interface VideoEntry {
  filename: string;
  stage: "input" | "processing" | "output";
  size: number;
  duration: number;
  width: number;
  height: number;
  codec: string;
  modified: string;
  hash?: string;
  theme?: string;
  youtube_url?: string;
  processed_at?: string;
  platforms: Record<string, { status: string; posted_at?: string; post_at?: string }>;
}

interface QueueEntry {
  index: number;
  platform: string;
  filename: string;
  status: string;
  post_at: string;
  posted_at?: string;
  youtube_url?: string;
  captions: Record<string, unknown>;
  all_captions?: Record<string, Record<string, unknown>>;
  result?: Record<string, unknown>;
}

interface ContentPost {
  id: string;
  platform: string;
  body: string;
  hashtags: string[];
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  platformUrl?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  engagementRate?: number;
  errorMessage?: string;
  createdAt: string;
}

interface ChatMsg { role: "user" | "assistant"; content: string }

interface MetricsEntry {
  index: number;
  platform: string;
  filename: string;
  posted_at?: string;
  url?: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  fetched_at?: string;
  fetch_error?: string;
}

interface TranscriptSegment { start: number; end: number; text: string }
interface TranscriptData { text: string; segments: TranscriptSegment[]; duration: number; language?: string }

interface ProgressData {
  active: boolean;
  filename?: string;
  size_mb?: number;
  age_seconds?: number;
  stage?: string;
  percent?: number;
  failed?: boolean;
  last_lines?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PLATFORMS = {
  tiktok: { label: "TikTok", color: "#00f2ea", icon: "\u{E000}", handle: "@digitaljared", followers: "30K" },
  youtube: { label: "YouTube", color: "#ff0000", icon: "\u{E001}", handle: "Digital Life", followers: "18.9K" },
  youtube_shorts: { label: "YT Shorts", color: "#ff0000", icon: "\u{E001}", handle: "Digital Life", followers: "18.9K" },
  instagram: { label: "Instagram", color: "#e1306c", icon: "\u{E002}", handle: "@digitaljared", followers: "—" },
  facebook: { label: "Facebook", color: "#1877f2", icon: "\u{E003}", handle: "Jared Tolley", followers: "—" },
  pinterest: { label: "Pinterest", color: "#e60023", icon: "\u{E004}", handle: "@jaredtolley", followers: "—" },
  linkedin: { label: "LinkedIn", color: "#0a66c2", icon: "\u{E005}", handle: "Jared Tolley", followers: "—" },
  twitter: { label: "X / Twitter", color: "#f5f5f5", icon: "\u{E006}", handle: "@digitaljared", followers: "—" },
} as Record<string, { label: string; color: string; icon: string; handle: string; followers: string }>;

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: "#1a1a2e", text: "#fbbf24", border: "#854d0e" },
  posted: { bg: "#0d2a1a", text: "#4ade80", border: "#166534" },
  published: { bg: "#0d2a1a", text: "#4ade80", border: "#166534" },
  failed: { bg: "#2a0d0d", text: "#f87171", border: "#991b1b" },
  draft: { bg: "#1a1a2e", text: "#818cf8", border: "#3730a3" },
  scheduled: { bg: "#1a1a2e", text: "#c084fc", border: "#6b21a8" },
  publishing: { bg: "#1a2a1a", text: "#fbbf24", border: "#854d0e" },
  input: { bg: "#1a1a2e", text: "#818cf8", border: "#3730a3" },
  processing: { bg: "#1a2a1a", text: "#fbbf24", border: "#854d0e" },
  output: { bg: "#0d2a1a", text: "#4ade80", border: "#166534" },
  connected: { bg: "#0d2a1a", text: "#4ade80", border: "#166534" },
  disconnected: { bg: "#2a0d0d", text: "#f87171", border: "#991b1b" },
  browser: { bg: "#1a1a2e", text: "#fbbf24", border: "#854d0e" },
};

function bytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function dur(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${Math.round(s % 60)}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function ago(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// NAV items
// ---------------------------------------------------------------------------
const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "\u25A3" },
  { id: "connections", label: "Connections", icon: "\u2B95" },
  { id: "workflows", label: "Workflows", icon: "\u21C4" },
  { id: "content", label: "Content", icon: "\u270E" },
  { id: "library", label: "Library", icon: "\u25B6" },
  { id: "queue", label: "Queue", icon: "\u23F3" },
  { id: "agent", label: "Agent", icon: "\u2728" },
  { id: "analytics", label: "Analytics", icon: "\u2191" },
  { id: "upload", label: "Upload", icon: "\u2B06" },
  { id: "logs", label: "Logs", icon: "\u2630" },
  { id: "settings", label: "Settings", icon: "\u2699" },
];

// =========================================================================
// MAIN PORTAL
// =========================================================================
export function ContentPortal() {
  // Read initial section from ?section=<id> so deep links like
  // /content?section=feeds (used from the Transcribe tab pointer) land on
  // the right panel. Falls back to dashboard on bad input or SSR.
  const [section, setSection] = useState<Section>(() => {
    if (typeof window === "undefined") return "dashboard";
    const fromUrl = new URLSearchParams(window.location.search).get("section");
    return fromUrl && (SECTIONS as string[]).includes(fromUrl)
      ? (fromUrl as Section)
      : "dashboard";
  });
  // Keep the URL in sync with the current section so shares/back-button
  // work. replaceState avoids cluttering the history.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (section === "dashboard") {
      url.searchParams.delete("section");
    } else {
      url.searchParams.set("section", section);
    }
    window.history.replaceState(null, "", url.toString());
  }, [section]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // API state
  const [apiUrl, setApiUrl] = useState("https://content-api.tolley.io");
  const [isLocal, setIsLocal] = useState(false);
  const [syncKey, setSyncKey] = useState("");
  const [autopilotKey, setAutopilotKey] = useState("autopilot-portal-2026");

  // Data
  const [status, setStatus] = useState<StatusData | null>(null);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [progress, setProgress] = useState<ProgressData>({ active: false });
  const [openVideo, setOpenVideo] = useState<VideoEntry | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [metrics, setMetrics] = useState<MetricsEntry[]>([]);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs for the auth keys + helpers — read inside polling closures so the
  // interval stays stable even when keys are bootstrapped or rotated.
  const apiUrlRef = useRef(apiUrl);
  const autopilotKeyRef = useRef(autopilotKey);
  const syncKeyRef = useRef(syncKey);
  useEffect(() => { apiUrlRef.current = apiUrl; }, [apiUrl]);
  useEffect(() => { autopilotKeyRef.current = autopilotKey; }, [autopilotKey]);
  useEffect(() => { syncKeyRef.current = syncKey; }, [syncKey]);

  // Upload state
  const [tusUrl, setTusUrl] = useState("https://upload.tolley.io/files/");

  // Bootstrap: get auth keys + detect network
  useEffect(() => {
    fetch("/api/content/portal-auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.key) setSyncKey(d.key);
        if (d.autopilotKey) setAutopilotKey(d.autopilotKey);
      })
      .catch(() => {});

    fetch("http://100.81.82.79:8096/api/status", {
      headers: { Authorization: "Bearer autopilot-portal-2026" },
      signal: AbortSignal.timeout(2000),
    })
      .then((r) => {
        if (r.ok) {
          setApiUrl("http://100.81.82.79:8096");
          setTusUrl("http://100.81.82.79:8090/files/");
          setIsLocal(true);
        }
      })
      .catch(() => {});
  }, []);

  // API helpers
  const autopilotFetch = useCallback(
    (path: string, opts?: RequestInit) =>
      fetch(`${apiUrl}${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${autopilotKey}`, ...opts?.headers },
      }).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }),
    [apiUrl, autopilotKey],
  );

  const contentFetch = useCallback(
    (path: string, opts?: RequestInit) => {
      if (!syncKey) return Promise.resolve(null);
      return fetch(`/api/content${path}`, {
        ...opts,
        headers: { "x-sync-secret": syncKey, "Content-Type": "application/json", ...opts?.headers },
      }).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      });
    },
    [syncKey],
  );

  // Load all data — defined as a stable callback that reads keys via refs,
  // so the polling interval doesn't get torn down + recreated every time
  // the auth keys are bootstrapped from /api/content/portal-auth.
  const loadAll = useCallback(async () => {
    const url = apiUrlRef.current;
    const key = autopilotKeyRef.current;
    const sync = syncKeyRef.current;
    const fetchAuto = (p: string) =>
      fetch(`${url}${p}`, { headers: { Authorization: `Bearer ${key}` } })
        .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
    try {
      const [s, v, q, m] = await Promise.all([
        fetchAuto("/api/status"),
        fetchAuto("/api/videos"),
        fetchAuto("/api/queue"),
        fetchAuto("/api/metrics").catch(() => ({ metrics: [] })),
      ]);
      setStatus(s);
      setVideos(v.videos);
      setQueue(q.queue);
      setMetrics(m.metrics ?? []);
    } catch {}

    if (sync) {
      try {
        const p = await fetch(`/api/content/posts?limit=100`, {
          headers: { "x-sync-secret": sync, "Content-Type": "application/json" },
        }).then((r) => (r.ok ? r.json() : null));
        if (p?.posts) setPosts(p.posts);
      } catch {}
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    refreshRef.current = setInterval(loadAll, 20000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadAll]);

  // Live progress poller — every 4s when something is processing, every 15s
  // when idle (in case a new pipeline kicks off). Throttled by visibility.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const p = await autopilotFetch("/api/progress");
        if (!cancelled) setProgress(p);
      } catch { /* ignore */ }
    };
    tick();
    const interval = progress.active ? 4000 : 15000;
    progressRef.current = setInterval(tick, interval);
    return () => { cancelled = true; if (progressRef.current) clearInterval(progressRef.current); };
  }, [autopilotFetch, progress.active]);

  useEffect(() => {
    if (section === "logs") {
      autopilotFetch("/api/logs?lines=300").then((d) => setLogs(d.logs)).catch(() => {});
    }
  }, [section, autopilotFetch]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  // Actions
  async function retryQueueEntry(idx: number) {
    await autopilotFetch(`/api/queue/${idx}/retry`, { method: "POST" });
    flash("Queued for retry");
    loadAll();
  }
  async function retryAllFailed() {
    const r = await autopilotFetch("/api/queue/retry-all", { method: "POST" });
    flash(`Retrying ${r.retried} failed posts`);
    loadAll();
  }
  async function deleteQueueEntry(idx: number) {
    await autopilotFetch(`/api/queue/${idx}`, { method: "DELETE" });
    flash("Removed");
    loadAll();
  }
  async function deleteVideo(name: string, stage: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await autopilotFetch(`/api/videos/${encodeURIComponent(name)}?stage=${stage}`, { method: "DELETE" });
    flash("Deleted");
    loadAll();
  }

  async function batchRepurpose(filenames: string[], platforms: string[], staggerMinutes: number, startAt: string | null) {
    // Find any queue entry per video to use as the source for cloning
    const sourceIndices: number[] = [];
    for (const fn of filenames) {
      const seed = queue.find((q) => q.filename === fn);
      if (seed) sourceIndices.push(seed.index);
    }
    if (sourceIndices.length === 0) {
      flash("Error: selected videos have no captions yet — wait for the autopilot to finish");
      return;
    }
    const r = await fetch(`${apiUrl}/api/queue/batch-duplicate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${autopilotKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_indices: sourceIndices,
        platforms,
        stagger_minutes: staggerMinutes,
        start_at: startAt ? new Date(startAt).toISOString() : null,
      }),
    });
    if (!r.ok) { flash(`Error: batch failed ${r.status}`); return; }
    const data = await r.json();
    flash(`Queued ${data.created} posts across ${platforms.length} platforms`);
    setSelected(new Set());
    loadAll();
  }

  async function refreshMetric(index: number) {
    try {
      await fetch(`${apiUrl}/api/metrics/refresh/${index}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${autopilotKey}` },
      });
      flash("Metrics refreshed");
      loadAll();
    } catch { flash("Error: refresh failed"); }
  }

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  const failedCount = queue.filter((q) => q.status === "failed").length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#06050a", color: "#f8f3ff", fontFamily: "'Sora', -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? 220 : 56,
          background: "#0a0914",
          borderRight: "1px solid #1a1730",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: sidebarOpen ? "18px 16px" : "18px 12px",
            borderBottom: "1px solid #1a1730",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {sidebarOpen && <span style={{ fontWeight: 700, fontSize: 15 }}>Content Studio</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", color: "#6b6b8a", cursor: "pointer", fontSize: 16, padding: 4 }}
          >
            {sidebarOpen ? "\u2190" : "\u2192"}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV.map((n) => {
            const active = section === n.id;
            const badge =
              n.id === "queue" ? failedCount :
              n.id === "library" ? videos.length :
              n.id === "content" ? posts.filter((p) => p.status === "draft").length :
              0;
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: sidebarOpen ? "10px 16px" : "10px 16px",
                  background: active ? "#141225" : "transparent",
                  border: "none",
                  borderLeft: active ? "3px solid #818cf8" : "3px solid transparent",
                  color: active ? "#f8f3ff" : "#6b6b8a",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{n.icon}</span>
                {sidebarOpen && <span style={{ flex: 1 }}>{n.label}</span>}
                {sidebarOpen && badge > 0 && (
                  <span style={{ background: n.id === "queue" ? "#7f1d1d" : "#1a1730", color: n.id === "queue" ? "#f87171" : "#818cf8", borderRadius: 10, padding: "1px 7px", fontSize: 10 }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Status footer */}
        {sidebarOpen && status && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid #1a1730", fontSize: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: status.daemon_running ? "#4ade80" : "#f87171" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: status.daemon_running ? "#4ade80" : "#f87171", animation: status.daemon_running ? "pulse 2s infinite" : "none" }} />
              Pipeline {status.daemon_running ? "Running" : "Offline"}
            </div>
            <div style={{ color: isLocal ? "#4ade80" : "#818cf8", marginTop: 4 }}>
              {isLocal ? "Tailscale" : "Tunnel"}
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 24, overflowY: "auto", minWidth: 0 }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 16, right: 16, zIndex: 9999,
            background: toast.startsWith("Error") ? "#7f1d1d" : "#14532d",
            border: `1px solid ${toast.startsWith("Error") ? "#991b1b" : "#166534"}`,
            color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontFamily: "inherit",
          }}>
            {toast}
          </div>
        )}

        {progress.active && <ProgressBanner data={progress} onJumpToLogs={() => setSection("logs")} />}

        {openVideo && (
          <VideoModal
            video={openVideo}
            queue={queue}
            metrics={metrics}
            apiUrl={apiUrl}
            autopilotKey={autopilotKey}
            onClose={() => setOpenVideo(null)}
            onChanged={loadAll}
            flash={flash}
          />
        )}

        {loading ? (
          <div style={{ color: "#6b6b8a", textAlign: "center", padding: 80 }}>Loading...</div>
        ) : (
          <>
            {section === "dashboard" && <DashboardSection status={status} videos={videos} queue={queue} posts={posts} onRetryAll={retryAllFailed} />}
            {section === "connections" && <ConnectionsSection />}
            {section === "workflows" && <WorkflowsSection status={status} />}
            {section === "content" && <ContentSection posts={posts} queue={queue} videos={videos} syncKey={syncKey} onRefresh={loadAll} flash={flash} onOpenVideo={setOpenVideo} />}
            {section === "library" && <LibrarySection videos={videos} apiUrl={apiUrl} autopilotKey={autopilotKey} metrics={metrics} selected={selected} onSelect={setSelected} onBatchRepurpose={batchRepurpose} onRefreshMetric={refreshMetric} onDelete={deleteVideo} onOpen={setOpenVideo} flash={flash} />}
            {section === "queue" && <QueueSection queue={queue} onRetry={retryQueueEntry} onRetryAll={retryAllFailed} onDelete={deleteQueueEntry} onOpenEditor={(entry) => {
              const v = videos.find(x => x.filename === entry.filename);
              if (v) setOpenVideo(v);
              else setOpenVideo({ filename: entry.filename, stage: "output", size: 0, duration: 0, width: 0, height: 0, codec: "", modified: "", platforms: {} });
            }} />}
            {section === "agent" && <AgentSection />}
            {section === "analytics" && <AnalyticsSection posts={posts} queue={queue} videos={videos} />}
            {section === "upload" && <UploadSection tusUrl={tusUrl} isLocal={isLocal} onNavigate={setSection} />}
            {section === "logs" && <LogsSection logs={logs} onRefresh={() => autopilotFetch("/api/logs?lines=300").then((d) => setLogs(d.logs))} />}
            {section === "settings" && <SettingsSection status={status} />}
          </>
        )}
      </main>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// =========================================================================
// VIDEO MODAL — player + per-platform caption editor + scheduler + repurpose
// =========================================================================
function VideoModal({
  video, queue, metrics, apiUrl, autopilotKey, onClose, onChanged, flash,
}: {
  video: VideoEntry;
  queue: QueueEntry[];
  metrics: MetricsEntry[];
  apiUrl: string;
  autopilotKey: string;
  onClose: () => void;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  // Find queue entries for this video so we can show captions + status per platform
  const videoQueue = useMemo(
    () => queue.filter((q) => q.filename === video.filename),
    [queue, video.filename]
  );

  // Best entry to seed captions: the first that has a non-empty captions block
  const seed = useMemo(() => {
    const withCaps = videoQueue.find((q) => q.all_captions && Object.keys(q.all_captions).length > 0);
    return withCaps ?? videoQueue[0];
  }, [videoQueue]);

  type Tab = "captions" | "schedule" | "repurpose" | "clip" | "metrics";
  const [tab, setTab] = useState<Tab>("captions");

  // Clip-editor state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [clipPlatforms, setClipPlatforms] = useState<string[]>(["tiktok", "instagram"]);
  const [clipRegen, setClipRegen] = useState(true);
  const [clipPostAt, setClipPostAt] = useState("");
  const [clipping, setClipping] = useState(false);

  // Per-video metrics
  const videoMetrics = useMemo(
    () => metrics.filter((m) => m.filename === video.filename),
    [metrics, video.filename]
  );
  const [activePlatform, setActivePlatform] = useState<string>(() => {
    if (seed?.all_captions) {
      const platforms = Object.keys(seed.all_captions);
      if (platforms.length) return platforms[0];
    }
    return "tiktok";
  });

  // Per-platform caption draft state — JSON-stringified for the editor
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    if (seed?.all_captions) {
      for (const [pl, body] of Object.entries(seed.all_captions)) {
        d[pl] = JSON.stringify(body, null, 2);
      }
    }
    return d;
  });
  const [saving, setSaving] = useState(false);
  const [reschedAt, setReschedAt] = useState<string>("");
  const [repurposePlatform, setRepurposePlatform] = useState<string>("linkedin");
  const [repurposeAt, setRepurposeAt] = useState<string>("");

  // Mint a short-lived signed stream URL via the Bearer-authed endpoint, so the
  // master key never rides in the <video src> query (logs/history/Referer leak).
  const [streamUrl, setStreamUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/api/videos/${encodeURIComponent(video.filename)}/stream-url`, {
      headers: { Authorization: `Bearer ${autopilotKey}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.url) setStreamUrl(`${apiUrl}${d.url}`); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiUrl, autopilotKey, video.filename]);

  // Find a pending queue entry for the activePlatform — that's the one we patch
  const activeEntry = videoQueue.find((q) => q.platform === activePlatform && q.status === "pending");

  async function saveCaptionsFor(platform: string) {
    const entry = videoQueue.find((q) => q.platform === platform && q.status === "pending");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(drafts[platform] || "{}"); }
    catch (e) { flash(`Error: invalid JSON for ${platform}`); return; }
    setSaving(true);
    try {
      if (entry) {
        // Patch the existing pending entry
        const r = await fetch(`${apiUrl}/api/queue/${entry.index}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${autopilotKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ captions: parsed }),
        });
        if (!r.ok) throw new Error(await r.text());
        flash(`Saved ${platform} caption`);
      } else {
        // No pending entry — auto-create one by duplicating a sibling
        // queue entry for this video, then setting the new entry's caption
        // for `platform`. Default post_at is now + 30 min so the user has
        // time to review before it fires.
        const seedIdx = videoQueue[0]?.index;
        if (seedIdx == null) {
          flash("Cannot save: this video has no queue entries to clone from");
          return;
        }
        const newPostAt = new Date(Date.now() + 30 * 60_000).toISOString();
        const r = await fetch(`${apiUrl}/api/queue/duplicate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${autopilotKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            source_index: seedIdx,
            platform,
            post_at: newPostAt,
            captions: parsed,
          }),
        });
        if (!r.ok) throw new Error(await r.text());
        flash(`Queued new ${platform} post for ${new Date(newPostAt).toLocaleTimeString()}`);
      }
      onChanged();
    } catch (e) {
      flash(`Error: save failed (${e})`);
    } finally {
      setSaving(false);
    }
  }

  async function postNow(platform: string) {
    const entry = videoQueue.find((q) => q.platform === platform && q.status === "pending");
    setSaving(true);
    try {
      // Save current draft first (this auto-creates an entry if none existed)
      await saveCaptionsFor(platform);
      // After save, find the entry (it may be brand new from the duplicate call)
      // We rely on onChanged() having re-pulled videoQueue, but since this is
      // local state, the simpler approach is to rely on the timer-based
      // refresh; we just flag the existing one if we found it earlier.
      if (entry) {
        const r1 = await fetch(`${apiUrl}/api/queue/${entry.index}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${autopilotKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ post_at: new Date().toISOString() }),
        });
        if (!r1.ok) throw new Error("reschedule failed");
        flash(`${platform}: will post on next worker tick (≤60s)`);
      } else {
        flash(`${platform}: queued — will post on next worker tick (≤60s)`);
      }
      onChanged();
    } catch (e) {
      flash(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function rescheduleAll() {
    if (!reschedAt) return flash("Pick a time first");
    setSaving(true);
    try {
      const isoTarget = new Date(reschedAt).toISOString();
      let count = 0;
      for (const [i, entry] of videoQueue.entries()) {
        if (entry.status !== "pending") continue;
        // Stagger — keep the same minute offsets relative to the earliest entry
        const sortedPending = videoQueue.filter((q) => q.status === "pending");
        const earliest = sortedPending.reduce((a, b) => (a.post_at < b.post_at ? a : b));
        const offsetMs = new Date(entry.post_at).getTime() - new Date(earliest.post_at).getTime();
        const target = new Date(new Date(reschedAt).getTime() + offsetMs).toISOString();
        const r = await fetch(`${apiUrl}/api/queue/${entry.index}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${autopilotKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ post_at: target }),
        });
        if (r.ok) count++;
      }
      flash(`Rescheduled ${count} pending posts (relative stagger preserved)`);
      onChanged();
    } catch (e) {
      flash(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function repurpose() {
    if (!seed || !seed.all_captions) {
      flash("No caption template available — generate one through the autopilot first");
      return;
    }
    const sourceIdx = videoQueue[0]?.index;
    if (sourceIdx == null) { flash("No source entry to clone from"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        source_index: sourceIdx,
        platform: repurposePlatform,
        post_at: repurposeAt ? new Date(repurposeAt).toISOString() : new Date().toISOString(),
      };
      const r = await fetch(`${apiUrl}/api/queue/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${autopilotKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      flash(`Queued for ${repurposePlatform}`);
      onChanged();
    } catch (e) {
      flash(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lazy-load transcript when Clip tab opens
  useEffect(() => {
    if (tab !== "clip" || transcript) return;
    setTranscriptLoading(true);
    fetch(`${apiUrl}/api/videos/${encodeURIComponent(video.filename)}/transcript`, {
      headers: { Authorization: `Bearer ${autopilotKey}` },
    })
      .then(async (r) => {
        if (r.ok) setTranscript(await r.json());
        else setTranscript(null);
      })
      .catch(() => setTranscript(null))
      .finally(() => setTranscriptLoading(false));
  }, [tab, transcript, apiUrl, autopilotKey, video.filename]);

  // Capture player duration once metadata loads
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      if (clipEnd === 0 && v.duration > 0) {
        setClipEnd(Math.min(v.duration, 30));
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [clipEnd]);

  function jumpTo(t: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      videoRef.current.play().catch(() => {});
    }
  }

  // Get the transcript text within [start, end]
  const clipTranscriptText = useMemo(() => {
    if (!transcript) return "";
    return transcript.segments
      .filter((s) => s.end >= clipStart && s.start <= clipEnd)
      .map((s) => s.text)
      .join(" ")
      .trim();
  }, [transcript, clipStart, clipEnd]);

  async function regenerateTranscriptNow() {
    setTranscriptLoading(true);
    try {
      const r = await fetch(`${apiUrl}/api/videos/${encodeURIComponent(video.filename)}/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${autopilotKey}` },
      });
      if (!r.ok) throw new Error(await r.text());
      flash("Transcribing — this can take 5-10 min on CPU. Refresh the tab when done.");
      // Re-fetch
      const t = await fetch(`${apiUrl}/api/videos/${encodeURIComponent(video.filename)}/transcript`, {
        headers: { Authorization: `Bearer ${autopilotKey}` },
      });
      if (t.ok) setTranscript(await t.json());
    } catch (e) {
      flash(`Error: ${e}`);
    } finally {
      setTranscriptLoading(false);
    }
  }

  async function queueClip() {
    if (clipEnd <= clipStart) { flash("End must be > start"); return; }
    if (clipPlatforms.length === 0) { flash("Pick at least one platform"); return; }
    setClipping(true);
    try {
      const r = await fetch(`${apiUrl}/api/videos/${encodeURIComponent(video.filename)}/clip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${autopilotKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          start_s: clipStart,
          end_s: clipEnd,
          platforms: clipPlatforms,
          post_at: clipPostAt ? new Date(clipPostAt).toISOString() : null,
          regenerate_captions: clipRegen,
          transcript_text: clipRegen ? clipTranscriptText : undefined,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      flash(`Clip queued: ${data.clip_filename} (${data.duration_s}s) → ${clipPlatforms.length} platform${clipPlatforms.length === 1 ? "" : "s"}`);
      onChanged();
    } catch (e) {
      flash(`Error: clip failed (${e})`);
    } finally {
      setClipping(false);
    }
  }

  async function refreshMetricLocal(idx: number) {
    try {
      const r = await fetch(`${apiUrl}/api/metrics/refresh/${idx}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${autopilotKey}` },
      });
      if (!r.ok) throw new Error(await r.text());
      flash("Metrics refreshed");
      onChanged();
    } catch (e) { flash(`Error: ${e}`); }
  }

  const platformsWithDrafts = Object.keys(drafts);
  const platformsWithoutDraft = ["tiktok", "instagram", "youtube_shorts", "facebook", "pinterest", "linkedin", "twitter"]
    .filter((p) => !platformsWithDrafts.includes(p));

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(2,1,8,0.85)", zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0a0914", border: "1px solid #2a2245", borderRadius: 14,
          width: "100%", maxWidth: 1200, maxHeight: "92vh", display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", overflow: "hidden",
          boxShadow: "0 24px 80px rgba(124,58,237,0.25)",
        }}
      >
        {/* Left — Player */}
        <div style={{ background: "#000", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", minHeight: 360 }}>
            <video
              ref={videoRef}
              src={streamUrl}
              controls
              playsInline
              preload="metadata"
              style={{ width: "100%", height: "100%", maxHeight: "70vh", background: "#000" }}
            />
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid #1a1730", background: "#06050a", fontSize: 12, color: "#9ca3af" }}>
            <div style={{ fontWeight: 600, color: "#f8f3ff", marginBottom: 4, wordBreak: "break-all" }}>{video.filename}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "#6b6b8a" }}>
              {video.duration > 0 && <span>{dur(video.duration)}</span>}
              {video.size > 0 && <span>{bytes(video.size)}</span>}
              {video.width > 0 && <span>{video.width}x{video.height}</span>}
              {video.codec && <span>{video.codec}</span>}
              {video.theme && <span style={{ color: "#c084fc" }}>theme: {video.theme}</span>}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <a href={streamUrl} download={video.filename} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2245", color: "#a78bfa", textDecoration: "none" }}>Download original</a>
              {video.youtube_url && <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2245", color: "#a78bfa", textDecoration: "none" }}>YouTube live →</a>}
            </div>
          </div>
        </div>

        {/* Right — Editor */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1a1730", background: "#0d0a1f" }}>
            {(["captions", "clip", "schedule", "repurpose", "metrics"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "12px 8px", background: tab === t ? "#14102a" : "transparent",
                  border: "none", borderBottom: tab === t ? "2px solid #a78bfa" : "2px solid transparent",
                  color: tab === t ? "#f8f3ff" : "#6b6b8a", fontFamily: "inherit", fontSize: 12, textTransform: "uppercase",
                  letterSpacing: 0.5, fontWeight: 600, cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
            <button
              onClick={onClose}
              style={{ width: 44, padding: 12, background: "transparent", border: "none", color: "#6b6b8a", fontSize: 18, cursor: "pointer" }}
              title="Close (Esc)"
            >×</button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0 }}>
            {tab === "captions" && (
              <>
                {/* Platform pills */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {platformsWithDrafts.map((pl) => {
                    const entry = videoQueue.find((q) => q.platform === pl);
                    const status = entry?.status ?? "—";
                    const active = pl === activePlatform;
                    const color = PLATFORMS[pl]?.color ?? "#818cf8";
                    return (
                      <button
                        key={pl}
                        onClick={() => setActivePlatform(pl)}
                        style={{
                          background: active ? "#14102a" : "#0d0a1f",
                          border: `1px solid ${active ? color : "#1a1730"}`, color: active ? color : "#6b6b8a",
                          borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{PLATFORMS[pl]?.label ?? pl}</span>
                        <span style={{ fontSize: 9, color: STATUS_STYLES[status]?.text ?? "#6b6b8a" }}>{status}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Editable caption JSON */}
                {!activeEntry && (
                  <div style={{ marginBottom: 10, padding: "8px 12px", background: "#0d2a1a", border: "1px solid #166534", borderRadius: 8, fontSize: 11, color: "#86efac" }}>
                    No pending {activePlatform} post yet. Save will queue a new post for this platform (default: 30 min from now). Use Post now to fire ASAP.
                  </div>
                )}
                <label style={{ fontSize: 11, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Caption JSON ({activePlatform})</label>
                <textarea
                  value={drafts[activePlatform] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [activePlatform]: e.target.value }))}
                  spellCheck
                  style={{
                    width: "100%", marginTop: 6, minHeight: 280, background: "#06050a",
                    border: "1px solid #1a1730", borderRadius: 8, padding: 12,
                    color: "#c4b5fd", fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                    lineHeight: 1.6, resize: "vertical", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <Btn primary onClick={() => saveCaptionsFor(activePlatform)} disabled={saving}>
                    {saving ? "Saving..." : (activeEntry ? "Save changes" : `Queue + save for ${PLATFORMS[activePlatform]?.label ?? activePlatform}`)}
                  </Btn>
                  <Btn onClick={() => postNow(activePlatform)} disabled={saving}>
                    Post now
                  </Btn>
                  <Btn onClick={() => {
                    if (seed?.all_captions?.[activePlatform]) {
                      setDrafts((d) => ({ ...d, [activePlatform]: JSON.stringify(seed.all_captions![activePlatform], null, 2) }));
                      flash("Reverted");
                    }
                  }} disabled={saving}>Revert</Btn>
                </div>
              </>
            )}

            {tab === "schedule" && (
              <>
                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 14 }}>
                  Reschedule all pending posts for this video. Relative stagger between platforms is preserved (e.g., if TikTok was 2hr ahead of Instagram, that gap stays).
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1a1730" }}>
                      <th style={{ textAlign: "left", padding: 8, color: "#6b6b8a", fontWeight: 500, fontSize: 10, textTransform: "uppercase" }}>Platform</th>
                      <th style={{ textAlign: "left", padding: 8, color: "#6b6b8a", fontWeight: 500, fontSize: 10, textTransform: "uppercase" }}>Status</th>
                      <th style={{ textAlign: "left", padding: 8, color: "#6b6b8a", fontWeight: 500, fontSize: 10, textTransform: "uppercase" }}>Scheduled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videoQueue.length === 0 ? (
                      <tr><td colSpan={3} style={{ padding: 12, color: "#6b6b8a", fontSize: 12 }}>Not in queue</td></tr>
                    ) : videoQueue.map((q) => (
                      <tr key={q.index} style={{ borderBottom: "1px solid #0e0d14" }}>
                        <td style={{ padding: 8 }}><PlatformPill platform={q.platform} /></td>
                        <td style={{ padding: 8 }}><Badge status={q.status} /></td>
                        <td style={{ padding: 8, color: "#9ca3af" }}>{new Date(q.post_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <label style={{ fontSize: 11, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>New start time (first platform)</label>
                <input
                  type="datetime-local"
                  value={reschedAt}
                  onChange={(e) => setReschedAt(e.target.value)}
                  style={{ width: "100%", marginTop: 6, background: "#06050a", border: "1px solid #1a1730", borderRadius: 8, padding: "8px 12px", color: "#f8f3ff", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" }}
                />
                <div style={{ marginTop: 12 }}>
                  <Btn primary onClick={rescheduleAll} disabled={saving || !reschedAt}>{saving ? "Rescheduling..." : "Reschedule pending"}</Btn>
                </div>
              </>
            )}

            {tab === "clip" && (
              <>
                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
                  Cut a section of this video and queue it as a separate post — perfect for pulling the punchiest 30-60s out of a long video and reposting it as a new clip with its own AI-written captions.
                </div>

                {/* Transcript availability */}
                {transcriptLoading && <div style={{ fontSize: 12, color: "#6b6b8a" }}>Loading transcript...</div>}
                {!transcriptLoading && !transcript && (
                  <div style={{ marginBottom: 12, padding: "10px 12px", background: "#1a1a2e", border: "1px solid #3730a3", borderRadius: 8, fontSize: 12 }}>
                    <div style={{ color: "#fbbf24", marginBottom: 6 }}>No transcript saved for this video.</div>
                    <div style={{ color: "#6b6b8a", marginBottom: 8 }}>You can still clip without one — captions will be cloned from the source instead. Or transcribe now (5-10 min on CPU).</div>
                    <Btn small onClick={regenerateTranscriptNow} disabled={transcriptLoading}>{transcriptLoading ? "Transcribing..." : "Transcribe now"}</Btn>
                  </div>
                )}

                {/* Start / End controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Start (s)</label>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
                      <input type="number" min="0" step="0.1" value={clipStart} onChange={(e) => setClipStart(Math.max(0, Number(e.target.value)))}
                        style={{ flex: 1, background: "#06050a", border: "1px solid #1a1730", borderRadius: 6, padding: "6px 10px", color: "#f8f3ff", fontSize: 12, fontFamily: "inherit" }} />
                      <Btn small onClick={() => { if (videoRef.current) setClipStart(parseFloat(videoRef.current.currentTime.toFixed(2))); }}>Use ▶</Btn>
                      <Btn small onClick={() => jumpTo(clipStart)}>Go</Btn>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>End (s)</label>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
                      <input type="number" min="0" step="0.1" value={clipEnd} onChange={(e) => setClipEnd(Math.max(0, Number(e.target.value)))}
                        style={{ flex: 1, background: "#06050a", border: "1px solid #1a1730", borderRadius: 6, padding: "6px 10px", color: "#f8f3ff", fontSize: 12, fontFamily: "inherit" }} />
                      <Btn small onClick={() => { if (videoRef.current) setClipEnd(parseFloat(videoRef.current.currentTime.toFixed(2))); }}>Use ▶</Btn>
                      <Btn small onClick={() => jumpTo(clipEnd)}>Go</Btn>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 14 }}>
                  Clip duration: {(clipEnd - clipStart).toFixed(1)}s {clipEnd > clipStart && `(${(clipEnd - clipStart) <= 60 ? "✓ short-form" : (clipEnd - clipStart) <= 180 ? "ok" : "⚠ over 3 min"})`}
                </div>

                {/* Transcript segments — clickable to set markers */}
                {transcript && transcript.segments.length > 0 && (
                  <>
                    <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Transcript — click a line to jump</label>
                    <div style={{ marginTop: 6, marginBottom: 12, maxHeight: 200, overflowY: "auto", background: "#06050a", border: "1px solid #1a1730", borderRadius: 8, padding: 8 }}>
                      {transcript.segments.map((seg, i) => {
                        const inClip = seg.end >= clipStart && seg.start <= clipEnd;
                        return (
                          <div
                            key={i}
                            onClick={() => jumpTo(seg.start)}
                            style={{ padding: "4px 8px", cursor: "pointer", fontSize: 11, lineHeight: 1.5, color: inClip ? "#c4b5fd" : "#9ca3af", borderLeft: inClip ? "2px solid #a78bfa" : "2px solid transparent", display: "flex", gap: 8 }}
                          >
                            <span style={{ color: "#6b6b8a", minWidth: 50, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{Math.floor(seg.start / 60)}:{(seg.start % 60).toFixed(0).padStart(2, "0")}</span>
                            <span style={{ flex: 1 }}>{seg.text}</span>
                            <span style={{ display: "flex", gap: 4 }}>
                              <button onClick={(e) => { e.stopPropagation(); setClipStart(seg.start); }} title="Set as clip start" style={{ background: "transparent", border: "1px solid #1a1730", color: "#6b6b8a", borderRadius: 4, padding: "1px 5px", fontSize: 9, cursor: "pointer" }}>⊢</button>
                              <button onClick={(e) => { e.stopPropagation(); setClipEnd(seg.end); }} title="Set as clip end" style={{ background: "transparent", border: "1px solid #1a1730", color: "#6b6b8a", borderRadius: 4, padding: "1px 5px", fontSize: 9, cursor: "pointer" }}>⊣</button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {clipTranscriptText && (
                      <div style={{ marginBottom: 12, padding: "8px 12px", background: "#0d2a1a", border: "1px solid #166534", borderRadius: 8, fontSize: 11, color: "#86efac" }}>
                        Selected text ({clipTranscriptText.split(" ").length} words): &ldquo;{clipTranscriptText.slice(0, 200)}{clipTranscriptText.length > 200 ? "..." : ""}&rdquo;
                      </div>
                    )}
                  </>
                )}

                {/* Platforms + options */}
                <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Post clip to</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, marginBottom: 12 }}>
                  {["tiktok", "instagram", "youtube_shorts", "facebook", "pinterest"].map((pl) => {
                    const on = clipPlatforms.includes(pl);
                    const color = PLATFORMS[pl]?.color ?? "#818cf8";
                    return (
                      <button key={pl} onClick={() => setClipPlatforms((cur) => on ? cur.filter((x) => x !== pl) : [...cur, pl])}
                        style={{ background: on ? "#14102a" : "#0d0a1f", border: `1px solid ${on ? color : "#1a1730"}`, color: on ? color : "#6b6b8a", borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        {on && "✓ "}{PLATFORMS[pl]?.label ?? pl}
                      </button>
                    );
                  })}
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9ca3af", marginBottom: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={clipRegen} onChange={(e) => setClipRegen(e.target.checked)} disabled={!transcript} />
                  Generate fresh AI captions from clip transcript
                  {!transcript && <span style={{ color: "#fbbf24", fontSize: 10 }}>(needs transcript)</span>}
                </label>

                <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Schedule (optional)</label>
                <input type="datetime-local" value={clipPostAt} onChange={(e) => setClipPostAt(e.target.value)}
                  style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "#06050a", border: "1px solid #1a1730", borderRadius: 8, padding: "8px 12px", color: "#f8f3ff", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" }} />

                <Btn primary onClick={queueClip} disabled={clipping || clipEnd <= clipStart || clipPlatforms.length === 0}>
                  {clipping ? "Cutting + queueing..." : `Cut + queue clip (${(clipEnd - clipStart).toFixed(1)}s)`}
                </Btn>
              </>
            )}

            {tab === "metrics" && (
              <>
                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 14 }}>
                  Per-post performance for this video. YouTube fetches live via Data API; Instagram and Facebook need page-level token wiring (coming soon). Click a row to refresh.
                </div>
                {videoMetrics.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "#6b6b8a", fontSize: 13, background: "#06050a", border: "1px solid #1a1730", borderRadius: 8 }}>
                    No posts have completed yet for this video. Metrics appear once a platform confirms publish.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {videoMetrics.map((m) => (
                      <div key={m.index} style={{ background: "#06050a", border: "1px solid #1a1730", borderRadius: 8, padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <PlatformPill platform={m.platform} />
                          <Btn small onClick={() => refreshMetricLocal(m.index)}>Refresh</Btn>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 6 }}>
                          <MetricStat label="Views" value={m.views} />
                          <MetricStat label="Likes" value={m.likes} />
                          <MetricStat label="Comments" value={m.comments} />
                          <MetricStat label="Shares" value={m.shares} />
                        </div>
                        {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#a78bfa" }}>{m.url}</a>}
                        {m.fetched_at && <div style={{ fontSize: 9, color: "#6b6b8a", marginTop: 2 }}>Updated: {ago(m.fetched_at)}</div>}
                        {m.fetch_error && <div style={{ fontSize: 10, color: "#fbbf24", marginTop: 4 }}>⚠ {m.fetch_error}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "repurpose" && (
              <>
                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 14 }}>
                  Push this video to a platform that wasn&apos;t in the original auto-stagger, or post a second time. The new entry copies the existing caption template (you can edit it in the Captions tab once it&apos;s queued).
                </div>
                <label style={{ fontSize: 11, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Target platform</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, marginBottom: 16 }}>
                  {platformsWithoutDraft.concat(platformsWithDrafts).map((pl) => {
                    const active = pl === repurposePlatform;
                    const color = PLATFORMS[pl]?.color ?? "#818cf8";
                    return (
                      <button
                        key={pl}
                        onClick={() => setRepurposePlatform(pl)}
                        style={{
                          background: active ? "#14102a" : "#0d0a1f",
                          border: `1px solid ${active ? color : "#1a1730"}`, color: active ? color : "#6b6b8a",
                          borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        {PLATFORMS[pl]?.label ?? pl}
                      </button>
                    );
                  })}
                </div>
                <label style={{ fontSize: 11, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Schedule (optional, defaults to now)</label>
                <input
                  type="datetime-local"
                  value={repurposeAt}
                  onChange={(e) => setRepurposeAt(e.target.value)}
                  style={{ width: "100%", marginTop: 6, background: "#06050a", border: "1px solid #1a1730", borderRadius: 8, padding: "8px 12px", color: "#f8f3ff", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" }}
                />
                <div style={{ marginTop: 12 }}>
                  <Btn primary onClick={repurpose} disabled={saving}>{saving ? "Queueing..." : `Queue for ${PLATFORMS[repurposePlatform]?.label ?? repurposePlatform}`}</Btn>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// LIVE PROGRESS BANNER
// =========================================================================
function ProgressBanner({ data, onJumpToLogs }: { data: ProgressData; onJumpToLogs: () => void }) {
  const failed = data.failed;
  const pct = Math.max(0, Math.min(100, data.percent ?? 0));
  const accent = failed ? "#f87171" : "#a78bfa";
  const ageMin = Math.floor((data.age_seconds ?? 0) / 60);
  const ageStr = ageMin > 0 ? `${ageMin}m ${Math.round((data.age_seconds ?? 0) % 60)}s` : `${Math.round(data.age_seconds ?? 0)}s`;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #14102a 0%, #0d0a1f 100%)",
        border: `1px solid ${failed ? "#7f1d1d" : "#3b2c66"}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        boxShadow: `0 0 0 1px ${accent}22, 0 8px 32px ${accent}11`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: failed ? "#f87171" : "#a78bfa", fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>
            {failed ? "PIPELINE FAILED" : "PROCESSING"} · {data.stage ?? "..."}
            {!failed && <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, animation: "pulse 1.4s infinite" }} />}
          </div>
          <div style={{ fontSize: 15, color: "#f8f3ff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.filename}
          </div>
          <div style={{ fontSize: 12, color: "#6b6b8a", marginTop: 2 }}>
            {data.size_mb} MB · running {ageStr}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: accent, fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</div>
          <button
            onClick={onJumpToLogs}
            style={{ background: "transparent", border: `1px solid ${accent}66`, color: accent, fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}
          >
            Full logs &rarr;
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "#111020", borderRadius: 8, height: 8, overflow: "hidden", marginBottom: 14 }}>
        <div
          style={{
            background: failed
              ? "linear-gradient(90deg, #7f1d1d, #f87171)"
              : "linear-gradient(90deg, #7c3aed, #a78bfa, #4f46e5)",
            height: "100%",
            width: `${pct}%`,
            transition: "width 0.6s",
            borderRadius: 8,
            boxShadow: failed ? "none" : `0 0 12px ${accent}99`,
          }}
        />
      </div>

      {/* Last 4 log lines */}
      {data.last_lines && data.last_lines.length > 0 && (
        <div
          style={{
            background: "#06050a",
            border: "1px solid #1a1730",
            borderRadius: 8,
            padding: "10px 12px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            lineHeight: 1.7,
            maxHeight: 110,
            overflow: "hidden",
          }}
        >
          {data.last_lines.map((ln, i) => {
            const isErr = /error|fail|exception/i.test(ln);
            const isWarn = /warn|timeout|retrying/i.test(ln);
            const isLatest = i === (data.last_lines!.length - 1);
            const c = isErr ? "#f87171" : isWarn ? "#fbbf24" : isLatest ? "#c4b5fd" : "#6b6b8a";
            return (
              <div key={i} style={{ color: c, display: "flex", gap: 8 }}>
                <span style={{ color: "#3b2c66", flexShrink: 0 }}>{isLatest ? ">" : " "}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ln}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SHARED COMPONENTS
// =========================================================================
function Badge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "#1a1a2e", text: "#818cf8", border: "#2a2a4e" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: "1px 8px", fontSize: 11, color: s.text, fontWeight: 500, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

function PlatformPill({ platform }: { platform: string }) {
  const p = PLATFORMS[platform] ?? { label: platform, color: "#818cf8" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#0e0d14", border: "1px solid #1a1730", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: p.color, textTransform: "uppercase" }}>
      {p.label}
    </span>
  );
}

function Card({ children, style: s, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: (e: React.MouseEvent) => void }) {
  return <div onClick={onClick} style={{ background: "#0e0d14", border: "1px solid #1a1730", borderRadius: 14, padding: 20, ...s }}>{children}</div>;
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h2>
      {right}
    </div>
  );
}

function Btn({ children, primary, danger, onClick, disabled, small, title }: { children: React.ReactNode; primary?: boolean; danger?: boolean; onClick?: (e?: React.MouseEvent) => void; disabled?: boolean; small?: boolean; title?: string }) {
  const bg = primary ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : danger ? "transparent" : "#1a1730";
  const border = danger ? "1px solid #991b1b" : primary ? "none" : "1px solid #2a2a4e";
  const color = danger ? "#f87171" : primary ? "#fff" : "#818cf8";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: bg, border, color, borderRadius: 8,
        padding: small ? "4px 12px" : "8px 20px",
        fontSize: small ? 11 : 13, fontWeight: primary ? 600 : 400,
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function MetricStat({ label, value }: { label: string; value: number | null | undefined }) {
  const display = value == null ? "—" : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  const color = value == null ? "#6b6b8a" : "#c4b5fd";
  return (
    <div style={{ background: "#0d0a1f", border: "1px solid #1a1730", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{display}</div>
      <div style={{ fontSize: 9, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Card>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b6b8a" }}>{label}</div>
    </Card>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#6b6b8a", fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>{children}</div>;
}

// =========================================================================
// DASHBOARD
// =========================================================================
function DashboardSection({ status, videos, queue, posts, onRetryAll }: { status: StatusData | null; videos: VideoEntry[]; queue: QueueEntry[]; posts: ContentPost[]; onRetryAll: () => void }) {
  if (!status) return null;
  const failed = queue.filter((q) => q.status === "failed");
  const recent = [...videos].sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 6);
  const published = posts.filter((p) => p.status === "published");

  return (
    <div>
      <SectionHeader title="Dashboard" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatBox label="In Queue" value={status.videos.input} color="#818cf8" />
        <StatBox label="Processing" value={status.videos.processing} color="#fbbf24" />
        <StatBox label="Completed" value={status.videos.total_processed} color="#4ade80" />
        <StatBox label="Failed Posts" value={status.queue.failed} color="#f87171" />
        <StatBox label="Published" value={status.queue.posted + published.length} color="#c084fc" />
        <StatBox label="Platforms" value={status.enabled_platforms.length} color="#00f2ea" />
      </div>

      {/* Post order */}
      <SubLabel>Posting Schedule</SubLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {status.posting_order.map((p, i) => (
          <div key={p.platform} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PlatformPill platform={p.platform} />
            <span style={{ fontSize: 11, color: "#6b6b8a" }}>{i === 0 ? "Now" : `+${p.delay_minutes / 60}h`}</span>
            {i < status.posting_order.length - 1 && <span style={{ color: "#2a2a4e" }}>&rarr;</span>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Recent videos */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Recent Videos</div>
          {recent.map((v) => (
            <div key={v.filename + v.stage} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1730", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{v.filename}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#6b6b8a", marginTop: 2 }}>
                  <Badge status={v.stage} />
                  {v.duration > 0 && <span>{dur(v.duration)}</span>}
                  <span>{bytes(v.size)}</span>
                </div>
              </div>
              <span style={{ fontSize: 11, color: "#6b6b8a", whiteSpace: "nowrap" }}>{ago(v.modified)}</span>
            </div>
          ))}
        </Card>

        {/* Failed posts */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Failed Posts</span>
            {failed.length > 0 && <Btn small primary onClick={onRetryAll}>Retry All ({failed.length})</Btn>}
          </div>
          {failed.length === 0 ? (
            <div style={{ color: "#4ade80", fontSize: 13 }}>All clear</div>
          ) : (
            failed.slice(0, 8).map((q) => (
              <div key={q.index} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1730", fontSize: 13 }}>
                <div>
                  <PlatformPill platform={q.platform} /> <span style={{ marginLeft: 6 }}>{q.filename}</span>
                </div>
                <Badge status="failed" />
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

// =========================================================================
// CONNECTIONS
// =========================================================================
function ConnectionsSection() {
  const connections = [
    { platform: "tiktok", status: "connected", method: "Browser (Playwright)", notes: "Session-based, auto-posting via content autopilot", lastUsed: "Active" },
    { platform: "youtube", status: "connected", method: "YouTube Data API v3", notes: "OAuth2, resumable upload, Shorts support", lastUsed: "Active" },
    { platform: "instagram", status: "connected", method: "Facebook Graph API", notes: "Reels via IG container API, needs FB page token", lastUsed: "Active" },
    { platform: "facebook", status: "connected", method: "Graph API v18.0", notes: "Page posts via access token, video upload", lastUsed: "Active" },
    { platform: "pinterest", status: "connected", method: "Browser (Selenium)", notes: "Session-based, persistent Chrome profile", lastUsed: "Active" },
    { platform: "linkedin", status: "connected", method: "OAuth 2.0 API", notes: "Community Management API, text + article posts", lastUsed: "Ready" },
    { platform: "twitter", status: "connected", method: "OAuth 2.0 PKCE", notes: "API v2, text-only (media Phase 2), 17 tweets/24hr", lastUsed: "Ready" },
  ];

  return (
    <div>
      <SectionHeader title="Platform Connections" />
      <p style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 24, marginTop: -12 }}>
        Manage your connected platforms. Video platforms use the Content Autopilot pipeline. Text platforms use the tolley.io Content Engine.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {connections.map((c) => {
          const p = PLATFORMS[c.platform];
          return (
            <Card key={c.platform} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#111020", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: p?.color ?? "#818cf8", fontSize: 14 }}>
                    {p?.label?.slice(0, 2) ?? "?"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p?.label ?? c.platform}</div>
                    <div style={{ fontSize: 11, color: "#6b6b8a" }}>{p?.handle}</div>
                  </div>
                </div>
                <Badge status={c.status} />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ background: "#111020", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#818cf8", border: "1px solid #1a1730" }}>
                  {c.method}
                </div>
                {p?.followers && p.followers !== "—" && (
                  <div style={{ background: "#111020", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#c084fc", border: "1px solid #1a1730" }}>
                    {p.followers} followers
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: "#6b6b8a", lineHeight: 1.5 }}>{c.notes}</div>

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <Btn small disabled title="Coming soon — will ping the platform's API and verify the cached session">Test Connection</Btn>
                <Btn small disabled title="Coming soon — will refresh OAuth tokens that are about to expire">Refresh Token</Btn>
                <Btn small danger disabled title="Coming soon — will revoke the saved session and clear cookies">Disconnect</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      <Card style={{ marginTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Add Platform</div>
        <p style={{ fontSize: 12, color: "#6b6b8a", marginBottom: 12 }}>
          Connect a new social platform to your distribution network. OAuth platforms connect instantly. Browser-based platforms need a one-time login.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn primary disabled title="Coming soon — OAuth handshake for new platforms">Connect via OAuth</Btn>
          <Btn disabled title="Coming soon — kicks off a noVNC browser to capture cookies for sites without OAuth (TikTok, Pinterest)">Setup Browser Session</Btn>
        </div>
      </Card>
    </div>
  );
}

// =========================================================================
// WORKFLOWS
// =========================================================================
function WorkflowsSection({ status }: { status: StatusData | null }) {
  const workflows = [
    { id: "auto-short", name: "Short Video \u2192 All Platforms", source: "Video Upload / Telegram", dest: status?.enabled_platforms ?? [], trigger: "Auto (< 3 min)", mode: "Staggered", active: true, desc: "Videos under 3 min get transcribed, captioned by AI, posted to TikTok immediately then staggered to other platforms." },
    { id: "auto-long", name: "Long Video \u2192 YouTube + Clips", source: "Video Upload / Telegram", dest: ["youtube", "tiktok", "instagram", "youtube_shorts"], trigger: "Auto (> 3 min)", mode: "Clips", active: true, desc: "Long videos get AI clip detection, posted full to YouTube, then best clips go to short-form platforms." },
    { id: "yt-reshare", name: "YouTube \u2192 Social Reshare", source: "YouTube Upload", dest: ["facebook", "twitter", "linkedin"], trigger: "Manual", mode: "Link post", active: false, desc: "When a YouTube video publishes, create link posts on social platforms to drive traffic." },
    { id: "listing-content", name: "Listing \u2192 Content", source: "MLS Listing", dest: ["instagram", "facebook", "linkedin"], trigger: "Manual", mode: "AI Generated", active: false, desc: "Generate platform-specific content from a real estate listing with AI-powered copy and hashtags." },
  ];

  return (
    <div>
      <SectionHeader title="Workflows" right={<Btn primary disabled title="Coming soon — workflow editor">Create Workflow</Btn>} />
      <p style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 24, marginTop: -12 }}>
        Define how content flows from source to destination. Active workflows run automatically.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {workflows.map((w) => (
          <Card key={w.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{w.name}</div>
                <div style={{ fontSize: 12, color: "#6b6b8a" }}>{w.desc}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Badge status={w.active ? "connected" : "disconnected"} />
                <div
                  title="Workflow toggle is informational for now — coming soon"
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: w.active ? "#166534" : "#1a1730",
                    position: "relative", cursor: "default", opacity: 0.7,
                    border: `1px solid ${w.active ? "#22c55e" : "#2a2a4e"}`,
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: w.active ? "#4ade80" : "#6b6b8a",
                    position: "absolute", top: 2,
                    left: w.active ? 20 : 2, transition: "left 0.2s",
                  }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#111020", border: "1px solid #1a1730", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#c084fc" }}>
                {w.source}
              </div>
              <span style={{ color: "#2a2a4e", fontSize: 18 }}>&rarr;</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {w.dest.map((d) => <PlatformPill key={d} platform={d} />)}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <div style={{ background: "#111020", border: "1px solid #1a1730", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#fbbf24" }}>
                  {w.trigger}
                </div>
                <div style={{ background: "#111020", border: "1px solid #1a1730", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#818cf8" }}>
                  {w.mode}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// CONTENT FEED
// =========================================================================
function ContentSection({ posts, queue, videos, syncKey, onRefresh, flash, onOpenVideo }: { posts: ContentPost[]; queue: QueueEntry[]; videos: VideoEntry[]; syncKey: string; onRefresh: () => void; flash: (m: string) => void; onOpenVideo: (v: VideoEntry) => void }) {
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newPlatform, setNewPlatform] = useState("facebook");
  const [newHashtags, setNewHashtags] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Group queue entries by video so we can render "AI-generated content cards"
  const videoGroups = useMemo(() => {
    const groups = new Map<string, QueueEntry[]>();
    for (const q of queue) {
      const list = groups.get(q.filename) ?? [];
      list.push(q);
      groups.set(q.filename, list);
    }
    // Sort filenames by latest post_at
    return Array.from(groups.entries()).sort((a, b) => {
      const aMax = Math.max(...a[1].map((q) => new Date(q.post_at).getTime()));
      const bMax = Math.max(...b[1].map((q) => new Date(q.post_at).getTime()));
      return bMax - aMax;
    });
  }, [queue]);

  async function createPost() {
    if (!newBody.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/content/posts", {
        method: "POST",
        headers: { "x-sync-secret": syncKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: newPlatform,
          body: newBody,
          hashtags: newHashtags.split(",").map((h) => h.trim()).filter(Boolean),
          status: "draft",
        }),
      });
      setNewBody("");
      setNewHashtags("");
      setShowCreate(false);
      flash("Draft created");
      onRefresh();
    } catch { flash("Error: Failed to create"); }
    setCreating(false);
  }

  async function publishPost(id: string) {
    try {
      await fetch(`/api/content/posts/${id}/publish`, {
        method: "POST",
        headers: { "x-sync-secret": syncKey },
      });
      flash("Publishing...");
      onRefresh();
    } catch { flash("Error: Publish failed"); }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post?")) return;
    try {
      await fetch(`/api/content/posts/${id}`, {
        method: "DELETE",
        headers: { "x-sync-secret": syncKey },
      });
      flash("Deleted");
      onRefresh();
    } catch { flash("Error: Delete failed"); }
  }

  return (
    <div>
      <SectionHeader title="Content" right={<Btn primary onClick={() => setShowCreate(true)}>Create Post</Btn>} />

      {/* AI-generated video content (from autopilot) */}
      {videoGroups.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
            AI-Generated from Uploads · {videoGroups.length} {videoGroups.length === 1 ? "video" : "videos"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
            {videoGroups.slice(0, 12).map(([filename, entries]) => {
              const v = videos.find((x) => x.filename === filename);
              const sample = entries.find((e) => e.all_captions && Object.keys(e.all_captions).length > 0) ?? entries[0];
              const captions = sample.all_captions || {};
              const tikCap = captions.tiktok as Record<string, string> | undefined;
              const previewText = (tikCap?.caption ?? "") || JSON.stringify(Object.values(captions)[0] ?? "").slice(0, 200);
              const counts = entries.reduce((acc, e) => { acc[e.status] = (acc[e.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
              return (
                <Card key={filename} style={{ padding: 0, overflow: "hidden" }}>
                  {v?.theme && (
                    <div style={{ padding: "8px 14px", background: "linear-gradient(135deg, #14102a, #0d0a1f)", borderBottom: "1px solid #1a1730", fontSize: 10, color: "#c084fc", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {v.theme}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => v && onOpenVideo(v)}
                    disabled={!v}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: 14, background: "transparent", border: "none", color: "inherit", fontFamily: "inherit", cursor: v ? "pointer" : "default" }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, wordBreak: "break-word", color: "#f8f3ff" }}>{filename}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.55, maxHeight: 60, overflow: "hidden", marginBottom: 10 }}>
                      {previewText}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                      {entries.map((e) => (
                        <span key={e.index} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: STATUS_STYLES[e.status]?.bg, border: `1px solid ${STATUS_STYLES[e.status]?.border}`, borderRadius: 4, padding: "1px 6px", fontSize: 9 }}>
                          <span style={{ color: PLATFORMS[e.platform]?.color, fontWeight: 700 }}>{PLATFORMS[e.platform]?.label?.slice(0, 2) ?? e.platform.slice(0, 2)}</span>
                          <span style={{ color: STATUS_STYLES[e.status]?.text }}>{e.status}</span>
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b6b8a" }}>
                      {Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(" · ")}
                    </div>
                  </button>
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #1a1730", display: "flex", gap: 6 }}>
                    <Btn small primary onClick={() => v && onOpenVideo(v)} disabled={!v}>Open editor</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>New Post</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["facebook", "twitter", "linkedin", "instagram", "tiktok", "youtube"].map((p) => (
              <button
                key={p}
                onClick={() => setNewPlatform(p)}
                style={{
                  background: newPlatform === p ? "#1a1a2e" : "transparent",
                  border: newPlatform === p ? `1px solid ${PLATFORMS[p]?.color ?? "#818cf8"}` : "1px solid #1a1730",
                  color: PLATFORMS[p]?.color ?? "#818cf8",
                  borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {PLATFORMS[p]?.label ?? p}
              </button>
            ))}
          </div>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Write your post..."
            style={{ width: "100%", minHeight: 100, background: "#111020", border: "1px solid #1a1730", borderRadius: 8, padding: 12, color: "#f8f3ff", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <input
            value={newHashtags}
            onChange={(e) => setNewHashtags(e.target.value)}
            placeholder="Hashtags (comma separated)"
            style={{ width: "100%", marginTop: 8, background: "#111020", border: "1px solid #1a1730", borderRadius: 8, padding: "8px 12px", color: "#f8f3ff", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn primary onClick={createPost} disabled={creating}>{creating ? "Creating..." : "Save Draft"}</Btn>
            <Btn onClick={() => setShowCreate(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "draft", "scheduled", "published", "failed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? "#1a1a2e" : "transparent",
              border: filter === f ? "1px solid #3730a3" : "1px solid #1a1730",
              color: filter === f ? "#818cf8" : "#6b6b8a",
              borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
            }}
          >
            {f} ({f === "all" ? posts.length : posts.filter((p) => p.status === f).length})
          </button>
        ))}
      </div>

      {/* Posts */}
      {sorted.length === 0 ? (
        <Card><div style={{ color: "#6b6b8a", textAlign: "center", padding: 20 }}>No posts yet. Create one or let the autopilot generate them.</div></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.slice(0, 30).map((p) => (
            <Card key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PlatformPill platform={p.platform} />
                  <Badge status={p.status} />
                  {p.scheduledAt && <span style={{ fontSize: 11, color: "#6b6b8a" }}>Scheduled: {new Date(p.scheduledAt).toLocaleString()}</span>}
                </div>
                <span style={{ fontSize: 11, color: "#6b6b8a" }}>{ago(p.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: "#c8c3d5", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "hidden" }}>
                {p.body}
              </div>
              {p.hashtags.length > 0 && (
                <div style={{ fontSize: 11, color: "#818cf8", marginTop: 6 }}>{p.hashtags.map((h) => `#${h}`).join(" ")}</div>
              )}
              {(p.likes != null || p.impressions != null) && (
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6b6b8a", marginTop: 8 }}>
                  {p.likes != null && <span>{p.likes} likes</span>}
                  {p.comments != null && <span>{p.comments} comments</span>}
                  {p.shares != null && <span>{p.shares} shares</span>}
                  {p.impressions != null && <span>{p.impressions} impressions</span>}
                </div>
              )}
              {p.errorMessage && <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>{p.errorMessage}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {p.status === "draft" && <Btn small primary onClick={() => publishPost(p.id)}>Publish Now</Btn>}
                {p.platformUrl && <a href={p.platformUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#818cf8", padding: "4px 0" }}>View &rarr;</a>}
                <Btn small danger onClick={() => deletePost(p.id)}>Delete</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// LIBRARY
// =========================================================================
interface LibrarySectionProps {
  videos: VideoEntry[];
  apiUrl: string;
  autopilotKey: string;
  metrics: MetricsEntry[];
  selected: Set<string>;
  onSelect: (s: Set<string>) => void;
  onBatchRepurpose: (
    filenames: string[],
    platforms: string[],
    staggerMinutes: number,
    startAt: string | null
  ) => void | Promise<void>;
  onRefreshMetric: (idx: number) => void;
  onDelete: (n: string, s: string) => void;
  onOpen: (v: VideoEntry) => void;
  flash: (msg: string) => void;
}

interface ManualPage { key: string; name: string; page_id: string; ready: boolean }

function LibrarySection({
  videos,
  apiUrl,
  autopilotKey,
  metrics,
  selected,
  onSelect,
  onBatchRepurpose,
  onRefreshMetric,
  onDelete,
  onOpen,
  flash,
}: LibrarySectionProps) {
  const [filter, setFilter] = useState("all");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [batchPlatforms, setBatchPlatforms] = useState<string[]>(["tiktok", "instagram", "youtube_shorts", "facebook", "pinterest"]);
  const [batchStagger, setBatchStagger] = useState(120);
  const [batchStart, setBatchStart] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);

  // Manual one-click posting targets (extra FB pages beyond the autopilot-managed one).
  const [manualPages, setManualPages] = useState<ManualPage[]>([]);
  const [manualPost, setManualPost] = useState<{ video: VideoEntry; page: ManualPage; caption: string } | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/api/manual-pages`, { headers: { Authorization: `Bearer ${autopilotKey}` } })
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((d) => setManualPages(d.pages || []))
      .catch(() => {});
  }, [apiUrl, autopilotKey]);

  async function openManualPost(v: VideoEntry, page: ManualPage) {
    if (!page.ready) {
      flash(`Error: ${page.name} has no token yet — run refresh_fb_token.py once Jared has Editor rights on the page`);
      return;
    }
    // Pre-fill with the autopilot-generated FB caption for this video, if any.
    let caption = "";
    try {
      const r = await fetch(`${apiUrl}/api/queue`, { headers: { Authorization: `Bearer ${autopilotKey}` } });
      const d = await r.json();
      const seed = (d.queue || []).find((q: { filename: string; all_captions?: { facebook?: { text?: string } } }) => q.filename === v.filename && q.all_captions?.facebook?.text);
      caption = seed?.all_captions?.facebook?.text || "";
    } catch {
      // no caption available — user will start from blank
    }
    setManualPost({ video: v, page, caption });
  }

  async function submitManualPost() {
    if (!manualPost) return;
    setPosting(true);
    try {
      const r = await fetch(`${apiUrl}/api/videos/${encodeURIComponent(manualPost.video.filename)}/post-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${autopilotKey}` },
        body: JSON.stringify({ page_key: manualPost.page.key, caption: manualPost.caption }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        flash(`Error posting to ${manualPost.page.name}: ${typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail || d).slice(0, 200)}`);
      } else {
        flash(`Posted to ${manualPost.page.name}${d.post_url ? ` — ${d.post_url}` : ""}`);
        setManualPost(null);
      }
    } catch (e: unknown) {
      flash(`Error posting: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPosting(false);
    }
  }

  // Metrics aggregated per video (sum across platforms)
  const metricsByVideo = useMemo(() => {
    const map = new Map<string, { views: number; likes: number; comments: number; platforms: number }>();
    for (const m of metrics) {
      const cur = map.get(m.filename) ?? { views: 0, likes: 0, comments: 0, platforms: 0 };
      cur.views += m.views ?? 0;
      cur.likes += m.likes ?? 0;
      cur.comments += m.comments ?? 0;
      cur.platforms += 1;
      map.set(m.filename, cur);
    }
    return map;
  }, [metrics]);

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    onSelect(next);
  }

  useEffect(() => {
    // Fetch thumbnails only for filenames we don't already have
    videos.forEach((v) => {
      if (thumbs[v.filename]) return;
      fetch(`${apiUrl}/api/videos/${encodeURIComponent(v.filename)}/thumbnail`, { headers: { Authorization: `Bearer ${autopilotKey}` } })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => { if (b) setThumbs((p) => ({ ...p, [v.filename]: URL.createObjectURL(b) })); })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, apiUrl, autopilotKey]);

  // Free blob URLs for videos that no longer exist (and on full unmount).
  // Without this, every fetched thumbnail leaks an ObjectURL forever.
  useEffect(() => {
    const liveNames = new Set(videos.map((v) => v.filename));
    setThumbs((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const [name, url] of Object.entries(prev)) {
        if (liveNames.has(name)) {
          next[name] = url;
        } else {
          URL.revokeObjectURL(url);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [videos]);

  useEffect(() => {
    return () => {
      // On unmount: revoke every cached blob URL
      Object.values(thumbs).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter === "all" ? videos : videos.filter((v) => v.stage === filter);
  const sorted = [...filtered].sort((a, b) => b.modified.localeCompare(a.modified));

  return (
    <div>
      <SectionHeader title="Video Library" />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "input", "processing", "output"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? "#1a1a2e" : "transparent", border: filter === f ? "1px solid #3730a3" : "1px solid #1a1730",
            color: filter === f ? "#818cf8" : "#6b6b8a", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
          }}>
            {f} ({f === "all" ? videos.length : videos.filter((v) => v.stage === f).length})
          </button>
        ))}
      </div>

      {/* Batch toolbar — appears when 1+ videos selected */}
      {selected.size > 0 && (
        <Card style={{ marginBottom: 14, border: "1px solid #3b2c66", background: "linear-gradient(135deg, #14102a, #0d0a1f)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: batchOpen ? 12 : 0, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>
              {selected.size} video{selected.size === 1 ? "" : "s"} selected
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn small onClick={() => onSelect(new Set())}>Clear</Btn>
              <Btn small primary onClick={() => setBatchOpen((o) => !o)}>{batchOpen ? "Hide" : "Batch repurpose →"}</Btn>
            </div>
          </div>
          {batchOpen && (
            <>
              <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Target platforms</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, marginBottom: 12 }}>
                {["tiktok", "instagram", "youtube_shorts", "facebook", "pinterest", "linkedin", "twitter"].map((pl) => {
                  const on = batchPlatforms.includes(pl);
                  const color = PLATFORMS[pl]?.color ?? "#818cf8";
                  return (
                    <button key={pl} onClick={() => setBatchPlatforms((cur) => on ? cur.filter((x) => x !== pl) : [...cur, pl])}
                      style={{ background: on ? "#14102a" : "#0d0a1f", border: `1px solid ${on ? color : "#1a1730"}`, color: on ? color : "#6b6b8a", borderRadius: 8, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                      {on && "✓ "}{PLATFORMS[pl]?.label ?? pl}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Stagger (minutes)</label>
                  <input type="number" min="1" step="5" value={batchStagger} onChange={(e) => setBatchStagger(Math.max(1, Number(e.target.value)))}
                    style={{ width: "100%", marginTop: 4, background: "#06050a", border: "1px solid #1a1730", borderRadius: 6, padding: "6px 10px", color: "#f8f3ff", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: 0.5 }}>Start at (optional)</label>
                  <input type="datetime-local" value={batchStart} onChange={(e) => setBatchStart(e.target.value)}
                    style={{ width: "100%", marginTop: 4, background: "#06050a", border: "1px solid #1a1730", borderRadius: 6, padding: "6px 10px", color: "#f8f3ff", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#6b6b8a", marginBottom: 12 }}>
                Will queue {selected.size * batchPlatforms.length} posts: {selected.size} videos × {batchPlatforms.length} platforms, {batchStagger} min apart
              </div>
              <Btn primary disabled={batchPlatforms.length === 0} onClick={() => onBatchRepurpose(Array.from(selected), batchPlatforms, batchStagger, batchStart || null)}>
                Queue {selected.size * batchPlatforms.length} posts
              </Btn>
            </>
          )}
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {sorted.map((v) => (
          <Card key={v.filename + v.stage} style={{ padding: 0, overflow: "hidden", position: "relative", transition: "border-color .15s", border: selected.has(v.filename) ? "1px solid #a78bfa" : undefined }}>
            {/* Checkbox \u2014 own click target, never overlaps anything else */}
            <label
              style={{
                position: "absolute", top: 8, left: 8, zIndex: 5,
                background: "rgba(10,9,20,0.92)", borderRadius: 6, padding: "4px 6px",
                display: "flex", alignItems: "center", cursor: "pointer", border: "1px solid rgba(167,139,250,0.3)",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(v.filename)}
                onChange={() => toggle(v.filename)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#a78bfa", margin: 0 }}
              />
            </label>

            {/* Clickable thumbnail = opens modal. As a real <button> so events behave. */}
            <button
              type="button"
              onClick={() => onOpen(v)}
              aria-label={`Open ${v.filename}`}
              style={{ display: "block", width: "100%", height: 160, background: "#111020", position: "relative", overflow: "hidden", border: "none", padding: 0, cursor: "pointer" }}
            >
              {thumbs[v.filename] ? (
                <img src={thumbs[v.filename]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#2a2a4e", fontSize: 32 }}>{"\u25B6"}</div>
              )}
              {/* Visual-only play badge \u2014 pointer-events:none so it can never block clicks */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.75))", pointerEvents: "none" }}>
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(124,58,237,0.92)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", boxShadow: "0 4px 16px rgba(124,58,237,0.5)" }}>{"\u25B6"}</div>
              </div>
              {v.duration > 0 && <div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,.8)", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 600, color: "#fff", pointerEvents: "none" }}>{dur(v.duration)}</div>}
              <div style={{ position: "absolute", top: 6, right: 6, pointerEvents: "none" }}><Badge status={v.stage} /></div>
            </button>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, wordBreak: "break-all", marginBottom: 4 }}>{v.filename}</div>
              <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#6b6b8a", marginBottom: 6, flexWrap: "wrap" }}>
                <span>{bytes(v.size)}</span>
                {v.width > 0 && <span>{v.width}x{v.height}</span>}
                {v.theme && <span style={{ color: "#c084fc" }}>{v.theme}</span>}
              </div>
              {Object.keys(v.platforms).length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                  {Object.entries(v.platforms).map(([pl, st]) => (
                    <span key={pl} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: STATUS_STYLES[st.status]?.bg, border: `1px solid ${STATUS_STYLES[st.status]?.border}`, borderRadius: 4, padding: "1px 6px", fontSize: 9 }}>
                      <span style={{ color: PLATFORMS[pl]?.color, fontWeight: 700 }}>{PLATFORMS[pl]?.label?.slice(0, 2) ?? pl}</span>
                      <span style={{ color: STATUS_STYLES[st.status]?.text }}>{st.status}</span>
                    </span>
                  ))}
                </div>
              )}
              {v.youtube_url && <a href={v.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#818cf8", textDecoration: "none" }}>YouTube &rarr;</a>}

              {/* Aggregated metrics row */}
              {(() => {
                const m = metricsByVideo.get(v.filename);
                if (!m || (m.views === 0 && m.likes === 0 && m.comments === 0)) return null;
                const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
                return (
                  <div style={{ marginTop: 8, padding: "6px 8px", background: "#0d0a1f", border: "1px solid #1a1730", borderRadius: 6, display: "flex", justifyContent: "space-around", gap: 6 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(m.views)}</div>
                      <div style={{ fontSize: 8, color: "#6b6b8a", textTransform: "uppercase" }}>Views</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(m.likes)}</div>
                      <div style={{ fontSize: 8, color: "#6b6b8a", textTransform: "uppercase" }}>Likes</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(m.comments)}</div>
                      <div style={{ fontSize: 8, color: "#6b6b8a", textTransform: "uppercase" }}>Comments</div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn small primary onClick={() => onOpen(v)}>Open</Btn>
                <Btn small danger onClick={() => onDelete(v.filename, v.stage)}>Delete</Btn>
              </div>

              {/* Manual one-click post targets (e.g. Ruthann's Treasure Haul) — only shown for output-stage videos */}
              {v.stage === "output" && manualPages.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1a1730", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {manualPages.map((mp) => (
                    <Btn
                      key={mp.key}
                      small
                      onClick={() => openManualPost(v, mp)}
                      disabled={!mp.ready}
                      title={mp.ready ? `Post this video to ${mp.name} (one-click, manual)` : `${mp.name}: token not provisioned yet`}
                    >
                      {mp.ready ? "Post to" : "[no token] Post to"} {mp.name}
                    </Btn>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Manual-post dialog: caption preview + edit + post */}
      {manualPost && (
        <div
          onClick={() => !posting && setManualPost(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(5,4,15,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
        >
          <Card
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 540, padding: 20, border: "1px solid #3b2c66" }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Post to {manualPost.page.name}</div>
            <div style={{ fontSize: 11, color: "#6b6b8a", marginBottom: 12, wordBreak: "break-all" }}>{manualPost.video.filename}</div>
            <SubLabel>Caption</SubLabel>
            <textarea
              value={manualPost.caption}
              onChange={(e) => setManualPost({ ...manualPost, caption: e.target.value })}
              rows={6}
              style={{
                width: "100%", background: "#0d0a1f", border: "1px solid #1a1730", color: "#e0d8ff",
                padding: 10, borderRadius: 6, fontSize: 13, fontFamily: "inherit", resize: "vertical",
              }}
              placeholder="Edit the caption before posting..."
            />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn small onClick={() => setManualPost(null)} disabled={posting}>Cancel</Btn>
              <Btn small primary onClick={submitManualPost} disabled={posting}>
                {posting ? "Posting..." : `Post to ${manualPost.page.name}`}
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// QUEUE
// =========================================================================
function QueueSection({ queue, onRetry, onRetryAll, onDelete, onOpenEditor }: { queue: QueueEntry[]; onRetry: (i: number) => void; onRetryAll: () => void; onDelete: (i: number) => void; onOpenEditor: (entry: QueueEntry) => void }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? queue : queue.filter((q) => q.status === filter);
  const failedN = queue.filter((q) => q.status === "failed").length;

  return (
    <div>
      <SectionHeader title="Publishing Queue" right={failedN > 0 ? <Btn primary onClick={onRetryAll}>Retry All Failed ({failedN})</Btn> : undefined} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "pending", "posted", "failed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? "#1a1a2e" : "transparent", border: filter === f ? "1px solid #3730a3" : "1px solid #1a1730",
            color: filter === f ? "#818cf8" : "#6b6b8a", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
          }}>
            {f} ({f === "all" ? queue.length : queue.filter((q) => q.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><div style={{ color: "#6b6b8a", textAlign: "center", padding: 20 }}>No entries</div></Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1a1730" }}>
                {["Platform", "Video", "Status", "Scheduled", "Posted", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#6b6b8a", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.index} style={{ borderBottom: "1px solid #0e0d14" }}>
                  <td style={{ padding: "8px 14px" }}><PlatformPill platform={q.platform} /></td>
                  <td style={{ padding: "8px 14px", fontSize: 12, maxWidth: 180 }}>
                    <div style={{ wordBreak: "break-all" }}>{q.filename}</div>
                    {q.youtube_url && <a href={q.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#818cf8" }}>YT &rarr;</a>}
                  </td>
                  <td style={{ padding: "8px 14px" }}><Badge status={q.status} /></td>
                  <td style={{ padding: "8px 14px", fontSize: 11, color: "#6b6b8a" }}>{new Date(q.post_at).toLocaleString()}</td>
                  <td style={{ padding: "8px 14px", fontSize: 11, color: "#6b6b8a" }}>{q.posted_at ? ago(q.posted_at) : "\u2014"}</td>
                  <td style={{ padding: "8px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small onClick={() => onOpenEditor(q)}>Edit</Btn>
                      {q.status === "failed" && <Btn small primary onClick={() => onRetry(q.index)}>Retry</Btn>}
                      <Btn small danger onClick={() => onDelete(q.index)}>Remove</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Caption previews */}
      {filtered.some((q) => Object.keys(q.captions).length > 0) && (
        <div style={{ marginTop: 20 }}>
          <SubLabel>Caption Previews</SubLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filtered.filter((q) => Object.keys(q.captions).length > 0).slice(0, 4).map((q) => (
              <Card key={q.index}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <PlatformPill platform={q.platform} />
                  <span style={{ fontSize: 11, color: "#6b6b8a" }}>{q.filename}</span>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "pre-wrap", maxHeight: 100, overflowY: "auto", lineHeight: 1.5 }}>
                  {(() => {
                    const c = q.captions as Record<string, string>;
                    return c.caption || c.text || c.title || c.description || JSON.stringify(q.captions, null, 2);
                  })()}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// AGENT CHAT
// =========================================================================
function AgentSection() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    if (!input.trim() || sending) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    setSending(true);

    try {
      const r = await fetch("/api/content/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const d = await r.json();
      setMsgs([...newMsgs, { role: "assistant", content: d.message || d.error || "No response" }]);
    } catch {
      setMsgs([...newMsgs, { role: "assistant", content: "Connection error. Check vLLM status." }]);
    }
    setSending(false);
  }

  const quickPrompts = [
    "Which platform should I focus on for growth?",
    "My TikTok posts keep failing. What should I check?",
    "Optimize my posting schedule for max engagement",
    "What content themes perform best for delivery drivers?",
    "How do I reconnect my Instagram token?",
    "Should I add LinkedIn to my video distribution?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", maxHeight: 800 }}>
      <SectionHeader title="Socialite Agent" />
      <p style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 16, marginTop: -12 }}>
        Chat with your content strategy AI. Ask about platform connections, workflow optimization, growth tactics, and troubleshooting.
      </p>

      {/* Chat area */}
      <div style={{ flex: 1, background: "#0a0914", border: "1px solid #1a1730", borderRadius: 14, padding: 16, overflowY: "auto", marginBottom: 12, minHeight: 300 }}>
        {msgs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Hey Jared</div>
            <div style={{ color: "#6b6b8a", fontSize: 13, marginBottom: 20 }}>I{"'"}m Socialite, your content strategy assistant. Ask me anything about your distribution pipeline.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  style={{ background: "#111020", border: "1px solid #1a1730", borderRadius: 8, padding: "6px 12px", color: "#818cf8", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", maxWidth: 280 }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 10, color: "#6b6b8a", marginBottom: 4 }}>{m.role === "user" ? "You" : "Socialite"}</div>
              <div style={{
                background: m.role === "user" ? "#1a1a2e" : "#0e0d14",
                border: `1px solid ${m.role === "user" ? "#3730a3" : "#1a1730"}`,
                borderRadius: 10, padding: "10px 14px", maxWidth: "80%",
                fontSize: 13, lineHeight: 1.6, color: "#c8c3d5", whiteSpace: "pre-wrap",
              }}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b6b8a", fontSize: 12 }}>
            <span style={{ animation: "pulse 1s infinite" }}>Thinking...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about content strategy, platform connections, growth..."
          style={{ flex: 1, background: "#0e0d14", border: "1px solid #1a1730", borderRadius: 10, padding: "12px 16px", color: "#f8f3ff", fontSize: 14, fontFamily: "inherit", outline: "none" }}
        />
        <Btn primary onClick={send} disabled={sending || !input.trim()}>Send</Btn>
      </div>
    </div>
  );
}

// =========================================================================
// ANALYTICS
// =========================================================================
function AnalyticsSection({ posts, queue, videos }: { posts: ContentPost[]; queue: QueueEntry[]; videos: VideoEntry[] }) {
  const published = posts.filter((p) => p.status === "published");
  const totalLikes = published.reduce((a, p) => a + (p.likes ?? 0), 0);
  const totalComments = published.reduce((a, p) => a + (p.comments ?? 0), 0);
  const totalImpressions = published.reduce((a, p) => a + (p.impressions ?? 0), 0);
  const avgEngagement = published.length > 0 ? published.reduce((a, p) => a + (p.engagementRate ?? 0), 0) / published.length : 0;

  // Platform breakdown from queue
  const platformStats: Record<string, { total: number; posted: number; failed: number }> = {};
  queue.forEach((q) => {
    if (!platformStats[q.platform]) platformStats[q.platform] = { total: 0, posted: 0, failed: 0 };
    platformStats[q.platform].total++;
    if (q.status === "posted") platformStats[q.platform].posted++;
    if (q.status === "failed") platformStats[q.platform].failed++;
  });

  return (
    <div>
      <SectionHeader title="Analytics" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatBox label="Videos Processed" value={videos.filter((v) => v.stage === "output").length} color="#4ade80" />
        <StatBox label="Posts Published" value={published.length + queue.filter((q) => q.status === "posted").length} color="#c084fc" />
        <StatBox label="Total Likes" value={totalLikes} color="#e1306c" />
        <StatBox label="Total Comments" value={totalComments} color="#818cf8" />
        <StatBox label="Impressions" value={totalImpressions > 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : totalImpressions} color="#fbbf24" />
        <StatBox label="Avg Engagement" value={`${avgEngagement.toFixed(1)}%`} color="#00f2ea" />
      </div>

      <SubLabel>Platform Performance</SubLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {Object.entries(platformStats).map(([pl, stats]) => (
          <Card key={pl}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <PlatformPill platform={pl} />
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
              <div><span style={{ color: "#6b6b8a" }}>Total</span> <span style={{ color: "#f8f3ff", fontWeight: 600 }}>{stats.total}</span></div>
              <div><span style={{ color: "#6b6b8a" }}>Posted</span> <span style={{ color: "#4ade80", fontWeight: 600 }}>{stats.posted}</span></div>
              <div><span style={{ color: "#6b6b8a" }}>Failed</span> <span style={{ color: "#f87171", fontWeight: 600 }}>{stats.failed}</span></div>
            </div>
            {stats.total > 0 && (
              <div style={{ marginTop: 8, height: 6, background: "#111020", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(stats.posted / stats.total) * 100}%`, background: "#4ade80", borderRadius: 3 }} />
              </div>
            )}
          </Card>
        ))}
      </div>

      {published.length === 0 && Object.keys(platformStats).length === 0 && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ color: "#6b6b8a", fontSize: 14 }}>Analytics will populate as content gets published.</div>
        </Card>
      )}
    </div>
  );
}

// =========================================================================
// UPLOAD
// =========================================================================
function UploadSection({ tusUrl, isLocal, onNavigate }: { tusUrl: string; isLocal: boolean; onNavigate: (s: Section) => void }) {
  const [state, setState] = useState<{ s: "idle" } | { s: "uploading"; name: string; pct: number; sent: number; total: number | null } | { s: "done"; name: string } | { s: "error"; msg: string }>({ s: "idle" });
  const [title, setTitle] = useState("");
  const uppyRef = useRef<import("@uppy/core").Uppy | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|webm|avi|mkv|m4v|hevc)$/i)) {
      setState({ s: "error", msg: "Video files only." });
      return;
    }
    const { default: Uppy } = await import("@uppy/core");
    const { default: Tus } = await import("@uppy/tus");
    const name = title.trim() ? `${title.trim().replace(/[^a-zA-Z0-9_\- ]/g, "")}.${file.name.split(".").pop()}` : file.name;
    const uppy = new Uppy({ autoProceed: true }).use(Tus, { endpoint: tusUrl, retryDelays: [0, 1000, 3000, 5000], chunkSize: 5 * 1024 * 1024 });
    uppyRef.current = uppy;
    uppy.addFile({ name, type: file.type || "video/mp4", data: file });
    setState({ s: "uploading", name, pct: 0, sent: 0, total: file.size });
    uppy.on("upload-progress", (_, p) => setState({ s: "uploading", name, pct: p.bytesTotal ? Math.round((p.bytesUploaded / p.bytesTotal) * 100) : 0, sent: p.bytesUploaded, total: p.bytesTotal }));
    uppy.on("complete", () => { setState({ s: "done", name }); setTitle(""); uppy.destroy(); uppyRef.current = null; });
    uppy.on("upload-error", (_, e) => { setState({ s: "error", msg: e?.message || "Upload failed" }); uppy.destroy(); uppyRef.current = null; });
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <SectionHeader title="Upload Video" />
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: isLocal ? "#0d2a1a" : "#1a1a2e", border: `1px solid ${isLocal ? "#1a5c3a" : "#2a2a4e"}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: isLocal ? "#4ade80" : "#818cf8" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: isLocal ? "#4ade80" : "#818cf8" }} />
          {isLocal ? "Tailscale (full quality)" : "Cloudflare tunnel"}
        </div>
      </div>

      <Card style={{ textAlign: "center" }}>
        {state.s === "idle" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title (optional)" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1a1730", background: "#111020", color: "#fff", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", marginBottom: 16 }} />
            <label style={{ cursor: "pointer", display: "block" }}>
              <input type="file" accept="video/*,.mp4,.mov,.webm,.avi,.mkv,.m4v" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} style={{ display: "none" }} />
              <div style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Select Video</div>
            </label>
            <div style={{ color: "#6b6b8a", fontSize: 13 }}>or drag &amp; drop — MP4, MOV, WEBM, AVI, MKV</div>
          </div>
        )}
        {state.s === "uploading" && (
          <>
            <div style={{ color: "#9ca3af", fontSize: 14, marginBottom: 8 }}>{state.name}</div>
            <div style={{ background: "#111020", borderRadius: 8, height: 8, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ background: "linear-gradient(90deg, #7c3aed, #4f46e5)", height: "100%", width: `${state.pct}%`, transition: "width .3s", borderRadius: 8 }} />
            </div>
            <div style={{ color: "#6b6b8a", fontSize: 12, marginBottom: 12 }}>{state.pct}% — {bytes(state.sent)}{state.total ? ` / ${bytes(state.total)}` : ""}</div>
            <Btn onClick={() => { uppyRef.current?.cancelAll(); uppyRef.current?.destroy(); uppyRef.current = null; setState({ s: "idle" }); }}>Cancel</Btn>
          </>
        )}
        {state.s === "done" && (
          <>
            <div style={{ color: "#4ade80", fontSize: 32, marginBottom: 8 }}>{"\u2713"}</div>
            <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 16 }}>Uploaded!</div>
            <div style={{ color: "#6b6b8a", fontSize: 12, marginBottom: 16 }}>{state.name}</div>
            <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              The pipeline is now transcribing, analyzing scenes, and cutting clips.
              <br />Watch progress in <strong style={{ color: "#a78bfa" }}>Library</strong> or live logs in <strong style={{ color: "#a78bfa" }}>Logs</strong>.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <Btn primary onClick={() => onNavigate("library")}>View in Library &rarr;</Btn>
              <Btn onClick={() => onNavigate("logs")}>Live Logs</Btn>
              <Btn onClick={() => onNavigate("queue")}>Posting Queue</Btn>
            </div>
            <Btn onClick={() => setState({ s: "idle" })}>Upload Another</Btn>
          </>
        )}
        {state.s === "error" && (
          <>
            <div style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{state.msg}</div>
            <Btn onClick={() => setState({ s: "idle" })}>Try Again</Btn>
          </>
        )}
      </Card>
    </div>
  );
}

// =========================================================================
// LOGS
// =========================================================================
function LogsSection({ logs, onRefresh }: { logs: string[]; onRefresh: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  return (
    <div>
      <SectionHeader title="Pipeline Logs" right={<Btn onClick={onRefresh}>Refresh</Btn>} />
      <div style={{ background: "#0a0914", border: "1px solid #1a1730", borderRadius: 12, padding: 14, maxHeight: 600, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.7 }}>
        {logs.length === 0 ? <div style={{ color: "#6b6b8a" }}>No logs</div> : logs.map((l, i) => {
          const c = /error|fail|exception/i.test(l) ? "#f87171" : /warn|timeout/i.test(l) ? "#fbbf24" : /success|complete|uploaded|posted/i.test(l) ? "#4ade80" : "#6b6b8a";
          return <div key={i} style={{ color: c }}>{l}</div>;
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// =========================================================================
// SETTINGS
// =========================================================================
function SettingsSection({ status }: { status: StatusData | null }) {
  return (
    <div>
      <SectionHeader title="Settings" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Enabled Platforms</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(PLATFORMS).map(([key, p]) => {
            const enabled = status?.enabled_platforms?.includes(key);
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, background: enabled ? "#0d2a1a" : "#111020", border: `1px solid ${enabled ? "#166534" : "#1a1730"}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: enabled ? "#4ade80" : "#6b6b8a" }} />
                <span style={{ color: enabled ? p.color : "#6b6b8a" }}>{p.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Posting Order &amp; Delays</div>
        {status?.posting_order?.map((p, i) => (
          <div key={p.platform} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #1a1730" }}>
            <span style={{ color: "#6b6b8a", fontSize: 12, width: 20 }}>{i + 1}.</span>
            <PlatformPill platform={p.platform} />
            <span style={{ fontSize: 12, color: "#6b6b8a" }}>{p.delay_minutes === 0 ? "Immediate" : `+${p.delay_minutes} min (${p.delay_minutes / 60}h)`}</span>
          </div>
        ))}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Pipeline Config</div>
        <div style={{ fontSize: 12, color: "#6b6b8a", lineHeight: 2 }}>
          <div>Short video threshold: <span style={{ color: "#f8f3ff" }}>3 minutes</span></div>
          <div>AI model: <span style={{ color: "#f8f3ff" }}>Qwen/Qwen3.5-35B-A3B-FP8 (local vLLM)</span></div>
          <div>Transcription: <span style={{ color: "#f8f3ff" }}>faster-whisper large-v3 (CPU int8)</span></div>
          <div>TUS upload server: <span style={{ color: "#f8f3ff" }}>Port 8090</span></div>
          <div>API server: <span style={{ color: "#f8f3ff" }}>Port 8096</span></div>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Creator Profile</div>
        <div style={{ fontSize: 12, color: "#6b6b8a", lineHeight: 2 }}>
          <div>Name: <span style={{ color: "#f8f3ff" }}>Jared Tolley</span></div>
          <div>TikTok: <span style={{ color: "#00f2ea" }}>@digitaljared (30K)</span></div>
          <div>YouTube: <span style={{ color: "#ff0000" }}>Digital Life (18.9K subs)</span></div>
          <div>Tone: <span style={{ color: "#c084fc" }}>authentic, energetic, storytelling, hustle culture</span></div>
          <div>Themes: <span style={{ color: "#818cf8" }}>delivery driver life, Walmart Spark, washer/dryer business, entrepreneurship, AI/tech, eBay reselling, real estate</span></div>
        </div>
      </Card>
    </div>
  );
}
