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

export default function SourceManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSource, setNewSource] = useState({ type: "youtube_channel", name: "", url: "", identifier: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/markets/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources || []))
      .catch(() => {});
  }, []);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Adding...");
    try {
      const res = await fetch("/api/markets/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSources((prev) => [...prev, data.source]);
      setNewSource({ type: "youtube_channel", name: "", url: "", identifier: "" });
      setShowAdd(false);
      setStatus("");
    } catch {
      setStatus("Failed to add source");
    }
  }

  async function toggleSource(id: string, active: boolean) {
    await fetch(`/api/markets/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, active: !active } : s));
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
          <select
            value={newSource.type}
            onChange={(e) => setNewSource({ ...newSource, type: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="youtube_channel">YouTube Channel</option>
            <option value="rss_feed">RSS Feed</option>
            <option value="blog">Blog</option>
          </select>
          <input
            type="text"
            placeholder="Name (e.g., Reventure Consulting)"
            value={newSource.name}
            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20"
            required
          />
          {newSource.type === "youtube_channel" ? (
            <input
              type="text"
              placeholder="Channel ID (e.g., UCBcRF18a7Qf58cCRy5xuWwQ)"
              value={newSource.identifier}
              onChange={(e) => setNewSource({ ...newSource, identifier: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20"
              required
            />
          ) : (
            <input
              type="url"
              placeholder="URL"
              value={newSource.url}
              onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20"
              required
            />
          )}
          <button type="submit" className="w-full px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
            Add Source
          </button>
          {status && <p className="text-[10px] text-red-400">{status}</p>}
        </form>
      )}

      <div className="space-y-1">
        {sources.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded bg-white/5 px-3 py-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.active ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}>
              {typeLabels[s.type] || s.type}
            </span>
            <span className="flex-1 text-xs text-white/70 truncate">{s.name}</span>
            <button onClick={() => toggleSource(s.id, s.active)} className="text-[10px] text-white/30 hover:text-white/50">
              {s.active ? "Pause" : "Resume"}
            </button>
            <button onClick={() => deleteSource(s.id)} className="text-[10px] text-red-400/50 hover:text-red-400">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
