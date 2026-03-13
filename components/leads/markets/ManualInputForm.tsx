"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onDataAdded?: () => void;
}

type InputType = "youtube" | "article" | "rss" | "channel" | "note";

export default function ManualInputForm({ onDataAdded }: Props) {
  const [inputType, setInputType] = useState<InputType>("youtube");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "polling" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    // Poll for new data every 5s, stop after 5 min
    const startTime = Date.now();
    pollRef.current = setInterval(() => {
      if (Date.now() - startTime > 300000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus({ type: "success", message: "Processing complete (check results below)" });
        onDataAdded?.();
        return;
      }
      onDataAdded?.();
    }, 5000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ type: "loading" });

    try {
      const body: Record<string, string> = { type: inputType };
      if (inputType === "note") {
        body.text = text;
        body.title = text.substring(0, 80);
      } else {
        body.url = url;
      }

      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // For types that dispatch to worker, show polling status
      if (inputType === "youtube" || inputType === "article") {
        if (data.dataPoints && data.dataPoints > 0) {
          setStatus({ type: "success", message: `Analyzed! ${data.dataPoints} result(s) added` });
          onDataAdded?.();
        } else if (data.errors && data.errors.length > 0) {
          setStatus({ type: "error", message: data.errors[0].substring(0, 120) });
        } else if (data.dispatched) {
          setStatus({ type: "success", message: `${inputType} analyzed and added to feed` });
          onDataAdded?.();
        } else {
          setStatus({ type: "success", message: "Submitted" });
          onDataAdded?.();
        }
      } else if (inputType === "rss") {
        const count = data.articlesAdded || 0;
        setStatus({ type: "success", message: `RSS feed subscribed — ${count} article${count !== 1 ? "s" : ""} pulled` });
        if (count > 0) onDataAdded?.();
      } else if (inputType === "channel") {
        setStatus({ type: "success", message: `Channel "${data.channelName || "subscribed"}" added — new videos will be auto-analyzed` });
        onDataAdded?.();
      } else {
        setStatus({ type: "success", message: "Note added" });
        onDataAdded?.();
      }

      setUrl("");
      setText("");
      setTimeout(() => setStatus({ type: "idle" }), 5000);
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Submission failed" });
      setTimeout(() => setStatus({ type: "idle" }), 5000);
    }
  }

  const types: { id: InputType; label: string }[] = [
    { id: "youtube", label: "YouTube Video" },
    { id: "article", label: "Article" },
    { id: "rss", label: "RSS Feed" },
    { id: "channel", label: "YT Channel" },
    { id: "note", label: "Note" },
  ];

  const placeholders: Record<InputType, string> = {
    youtube: "https://youtube.com/watch?v=... or youtu.be/...",
    article: "https://example.com/article-about-housing",
    rss: "https://example.com/feed/ or RSS feed URL",
    channel: "https://youtube.com/@ChannelName or channel URL",
    note: "",
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white/5 border border-white/5 p-4">
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setInputType(t.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              inputType === t.id
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-white/40 hover:text-white/60 border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {inputType === "note" ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a market observation or note..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30 resize-none"
          rows={3}
          required
        />
      ) : (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholders[inputType]}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30"
          required
        />
      )}

      {inputType === "rss" && (
        <p className="text-[10px] text-white/25 mt-1">
          Paste any RSS/Atom feed URL. Articles will be pulled and AI-analyzed automatically.
        </p>
      )}
      {inputType === "channel" && (
        <p className="text-[10px] text-white/25 mt-1">
          Paste a YouTube channel URL. New videos will be auto-transcribed and analyzed.
        </p>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs max-w-[70%]">
          {status.type === "loading" && (
            <span className="text-cyan-300 flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              Processing...
            </span>
          )}
          {status.type === "polling" && (
            <span className="text-amber-300 flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              {status.message}
            </span>
          )}
          {status.type === "success" && <span className="text-green-400">{status.message}</span>}
          {status.type === "error" && <span className="text-red-400">{status.message}</span>}
        </div>
        <button
          type="submit"
          disabled={status.type === "loading" || status.type === "polling"}
          className="px-4 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {status.type === "loading" ? "Analyzing..." : inputType === "rss" ? "Subscribe" : inputType === "channel" ? "Subscribe" : "Submit"}
        </button>
      </div>
    </form>
  );
}
