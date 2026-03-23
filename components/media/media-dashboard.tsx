"use client";

import { useState, useEffect, useCallback } from "react";

type Job = {
  id: string;
  url: string;
  category: string;
  title: string | null;
  status: string;
  progress: number;
  filename: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

type SearchResult = {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string | null;
};

type RecentFile = {
  name: string;
  category: string;
  size: number;
  added: string;
};

const CATEGORIES = [
  { value: "music", label: "Music (Audio)", icon: "🎵" },
  { value: "music-video", label: "Music Video", icon: "🎬" },
  { value: "video", label: "Video / Movie", icon: "🎥" },
] as const;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function MediaDashboard() {
  const [tab, setTab] = useState<"url" | "search">("url");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<string>("music");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/media/queue");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {}
  }, []);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/media/recent");
      if (res.ok) {
        const data = await res.json();
        setRecent(data.recent || []);
        setWorkerOnline(data.worker?.ok ?? false);
      }
    } catch {
      setWorkerOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchRecent();
    const interval = setInterval(() => {
      fetchQueue();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue, fetchRecent]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/media/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), category }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Download queued!");
        setUrl("");
        fetchQueue();
      } else {
        showToast(data.error || "Failed to submit");
      }
    } catch {
      showToast("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/media/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {}
    setSearching(false);
  }

  async function downloadResult(result: SearchResult) {
    try {
      const res = await fetch("/api/media/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          category,
          title: result.title,
        }),
      });
      if (res.ok) {
        showToast(`Queued: ${result.title}`);
        fetchQueue();
      }
    } catch {
      showToast("Failed to queue");
    }
  }

  const activeJobs = jobs.filter(
    (j) => j.status === "downloading" || j.status === "queued",
  );
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const failedJobs = jobs.filter((j) => j.status === "failed");

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 rounded-xl border border-purple-500/30 bg-purple-900/90 px-5 py-3 text-sm text-white shadow-lg backdrop-blur">
          {toast}
        </div>
      )}

      {/* Worker Status */}
      <div className="flex items-center gap-3">
        <div
          className={`h-2.5 w-2.5 rounded-full ${workerOnline ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : workerOnline === false ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`}
        />
        <span className="text-sm text-white/60">
          Transcode Box{" "}
          {workerOnline ? "Online" : workerOnline === false ? "Offline" : "Checking..."}
        </span>
        <a
          href="http://192.168.2.42:32400/web"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm text-purple-400 hover:text-purple-300"
        >
          Open Plex →
        </a>
      </div>

      {/* Input Tabs */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="mb-5 flex gap-1 rounded-lg bg-white/5 p-1">
          <button
            onClick={() => setTab("url")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${tab === "url" ? "bg-purple-600 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            Paste URL
          </button>
          <button
            onClick={() => setTab("search")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${tab === "search" ? "bg-purple-600 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            Search YouTube
          </button>
        </div>

        {/* Category Selector */}
        <div className="mb-4 flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-lg border px-4 py-2 text-sm transition ${category === c.value ? "border-purple-500/50 bg-purple-900/30 text-white" : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"}`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {tab === "url" ? (
          <form onSubmit={handleSubmitUrl} className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="rounded-xl bg-purple-600 px-6 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-40"
            >
              {submitting ? "Queuing..." : "Download"}
            </button>
          </form>
        ) : (
          <div>
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search for a song, e.g. "Bohemian Rhapsody"'
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="rounded-xl bg-purple-600 px-6 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-40"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10"
                  >
                    {r.thumbnail && (
                      <img
                        src={r.thumbnail}
                        alt=""
                        className="h-14 w-24 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {r.title}
                      </p>
                      <p className="text-xs text-white/40">
                        {r.channel}
                        {r.duration ? ` · ${formatDuration(r.duration)}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadResult(r)}
                      className="shrink-0 rounded-lg border border-purple-500/30 bg-purple-900/20 px-4 py-2 text-sm text-purple-300 transition hover:bg-purple-900/40"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Downloads */}
      {activeJobs.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/70 uppercase">
            Active Downloads
          </h3>
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-purple-500/20 bg-purple-900/10 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    {job.filename || job.title || job.url}
                  </span>
                  <span className="rounded-full bg-purple-600/30 px-2.5 py-0.5 text-xs text-purple-300">
                    {job.status}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-white/40">
                  {job.progress.toFixed(0)}% · {job.category}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Completions + Failures */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Completed */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/70 uppercase">
            Completed ({completedJobs.length})
          </h3>
          {completedJobs.length === 0 ? (
            <p className="text-sm text-white/30">No completed downloads yet</p>
          ) : (
            <div className="space-y-2">
              {completedJobs.slice(0, 10).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 rounded-lg border border-white/5 p-3"
                >
                  <span className="text-green-400">✓</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {job.filename || job.title || job.url}
                    </p>
                    <p className="text-xs text-white/40">
                      {job.category} ·{" "}
                      {job.completedAt ? timeAgo(job.completedAt) : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent in Library */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-white/70 uppercase">
            Recent in Library
          </h3>
          {recent.length === 0 ? (
            <p className="text-sm text-white/30">No files in library yet</p>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 10).map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-white/5 p-3"
                >
                  <span className="text-white/30">
                    {f.category === "music" ? "🎵" : f.category === "music-video" ? "🎬" : "🎥"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{f.name}</p>
                    <p className="text-xs text-white/40">
                      {formatSize(f.size)} · {timeAgo(f.added)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Failed Jobs */}
      {failedJobs.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-900/5 p-6">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-red-400/70 uppercase">
            Failed ({failedJobs.length})
          </h3>
          <div className="space-y-2">
            {failedJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="rounded-lg border border-red-500/10 p-3">
                <p className="truncate text-sm text-white">
                  {job.title || job.url}
                </p>
                <p className="mt-1 text-xs text-red-400/60">
                  {job.error?.slice(0, 150)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
