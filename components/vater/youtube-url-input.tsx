"use client";

import { useState } from "react";

const YT_RE =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (project: any) => void;
}

export function YouTubeUrlInput({ onCreated }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = YT_RE.test(url.trim());

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vater/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }

      const data = await res.json();
      onCreated(data.project);
      setUrl("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vater-card p-4">
      <div className="flex gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
          <span className="text-lg">📺</span>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Paste YouTube URL..."
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="rounded-lg bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Importing..." : "Import"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
