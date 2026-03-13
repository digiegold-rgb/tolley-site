"use client";

import { useState, useEffect } from "react";

interface Source {
  id: string;
  type: string;
  name: string;
  url?: string;
  identifier?: string;
  active: boolean;
  lastChecked?: string;
}

interface Props {
  onSourceAdded?: () => void;
}

export default function SourceManager({ onSourceAdded }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"rss" | "channel">("rss");
  const [inputUrl, setInputUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/markets/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources || []))
      .catch(() => {});
  }, []);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Adding...");

    try {
      // Use the main /api/markets POST which handles resolution
      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addType === "channel" ? "channel" : "rss",
          url: inputUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      // Refresh sources list
      const refreshRes = await fetch("/api/markets/sources");
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setSources(refreshData.sources || []);
      }

      setInputUrl("");
      setShowAdd(false);
      setStatus("");
      onSourceAdded?.();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setLoading(false);
    }
  }

  async function toggleSource(id: string, active: boolean) {
    await fetch(`/api/markets/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active: !active } : s)));
  }

  async function deleteSource(id: string) {
    await fetch(`/api/markets/sources/${id}`, { method: "DELETE" });
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  const typeLabels: Record<string, string> = {
    youtube_channel: "YouTube",
    rss_feed: "RSS",
    stock_ticker: "Stock",
    fred_indicator: "FRED",
    blog: "Blog",
  };

  const typeColors: Record<string, string> = {
    youtube_channel: "bg-red-500/20 text-red-400",
    rss_feed: "bg-orange-500/20 text-orange-400",
    stock_ticker: "bg-green-500/20 text-green-400",
    fred_indicator: "bg-blue-500/20 text-blue-400",
    blog: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{sources.length} sources</span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-cyan-300 hover:text-cyan-200"
        >
          {showAdd ? "Cancel" : "+ Add Source"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addSource} className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddType("rss")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                addType === "rss"
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              RSS Feed
            </button>
            <button
              type="button"
              onClick={() => setAddType("channel")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                addType === "channel"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              YouTube Channel
            </button>
          </div>

          <input
            type="url"
            placeholder={
              addType === "channel"
                ? "https://youtube.com/@ChannelName"
                : "https://example.com/feed/"
            }
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30"
            required
          />

          <p className="text-[10px] text-white/25">
            {addType === "channel"
              ? "Paste any YouTube channel URL. We'll auto-detect the channel and monitor for new videos."
              : "Paste an RSS or Atom feed URL. Articles will be AI-analyzed automatically."}
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium disabled:opacity-50"
          >
            {loading ? "Adding..." : "Subscribe"}
          </button>
          {status && status !== "Adding..." && (
            <p className="text-[10px] text-red-400">{status}</p>
          )}
        </form>
      )}

      <div className="space-y-1">
        {sources.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded bg-white/5 px-3 py-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                s.active
                  ? typeColors[s.type] || "bg-white/10 text-white/50"
                  : "bg-white/5 text-white/30"
              }`}
            >
              {typeLabels[s.type] || s.type}
            </span>
            <span className="flex-1 text-xs text-white/70 truncate" title={s.url || s.identifier}>
              {s.name}
            </span>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-white/20 hover:text-white/40"
              >
                link
              </a>
            )}
            <button
              onClick={() => toggleSource(s.id, s.active)}
              className="text-[10px] text-white/30 hover:text-white/50"
            >
              {s.active ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() => deleteSource(s.id)}
              className="text-[10px] text-red-400/50 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
