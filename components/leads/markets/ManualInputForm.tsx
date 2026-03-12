"use client";

import { useState } from "react";

export default function ManualInputForm() {
  const [inputType, setInputType] = useState<"youtube" | "article" | "note">("youtube");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message?: string }>({ type: "idle" });

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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setStatus({ type: "success", message: `${inputType} submitted for analysis` });
      setUrl("");
      setText("");
      setTimeout(() => setStatus({ type: "idle" }), 3000);
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Submission failed" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white/5 border border-white/5 p-4">
      <div className="flex gap-2 mb-3">
        {(["youtube", "article", "note"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setInputType(t)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              inputType === t ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-white/40 hover:text-white/60"
            }`}
          >
            {t === "youtube" ? "YouTube" : t === "article" ? "Article" : "Note"}
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
          placeholder={inputType === "youtube" ? "https://youtube.com/watch?v=..." : "https://example.com/article"}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30"
          required
        />
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs">
          {status.type === "loading" && <span className="text-cyan-300">Processing...</span>}
          {status.type === "success" && <span className="text-green-400">{status.message}</span>}
          {status.type === "error" && <span className="text-red-400">{status.message}</span>}
        </div>
        <button
          type="submit"
          disabled={status.type === "loading"}
          className="px-4 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          {status.type === "loading" ? "Analyzing..." : "Submit"}
        </button>
      </div>
    </form>
  );
}
