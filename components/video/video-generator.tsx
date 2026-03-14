"use client";

import { useState, useRef, useCallback } from "react";
import { VIDEO_TIERS, type VideoTier } from "@/lib/video";

type Status = "idle" | "queued" | "generating" | "done" | "error";

export function VideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState<VideoTier>("basic");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedTier = VIDEO_TIERS.find((t) => t.id === tier)!;

  // Fetch credit balance on mount
  const balanceFetched = useRef(false);
  if (!balanceFetched.current) {
    balanceFetched.current = true;
    fetch("/api/video/credits")
      .then((r) => r.json())
      .then((d) => setCreditBalance(d.balance))
      .catch(() => {});
  }

  const refreshBalance = useCallback(() => {
    fetch("/api/video/credits")
      .then((r) => r.json())
      .then((d) => setCreditBalance(d.balance))
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setStatus("queued");
    setProgress("Submitting...");
    setResultUrl(null);
    setError(null);

    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), tier }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          throw new Error(`Insufficient credits: need ${data.required}, have ${data.balance}`);
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setCreditBalance(data.creditsRemaining);
      setStatus("generating");
      setProgress(`Generating ${selectedTier.name} video...`);

      // Poll for completion
      let elapsed = 0;
      pollRef.current = setInterval(async () => {
        elapsed += 3;
        setProgress(`Generating... ${elapsed}s elapsed`);

        try {
          const pollRes = await fetch(`/api/video/status?id=${data.generationId}`);
          if (!pollRes.ok) return;
          const pollData = await pollRes.json();

          if (pollData.status === "completed") {
            clearInterval(pollRef.current!);
            setStatus("done");
            setProgress(`Done in ${elapsed}s`);
            if (pollData.outputUrl) setResultUrl(pollData.outputUrl);
          } else if (pollData.status === "failed") {
            clearInterval(pollRef.current!);
            setStatus("error");
            setError(pollData.error || "Generation failed");
            refreshBalance(); // Credits may have been refunded
          }
        } catch {
          // keep polling
        }
      }, 3000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const insufficientCredits = creditBalance !== null && creditBalance < selectedTier.credits;

  return (
    <section id="generate" className="scroll-mt-8">
      <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-b from-purple-500/[0.06] to-transparent p-6 sm:p-8">
        {/* Header with credit balance */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-white uppercase sm:text-3xl">
            Generate a Video
          </h2>
          {creditBalance !== null && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Credits:</span>
              <span className={`text-lg font-black ${creditBalance > 0 ? "text-purple-300" : "text-red-400"}`}>
                {creditBalance}
              </span>
            </div>
          )}
        </div>

        {/* Tier picker */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {VIDEO_TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTier(t.id as VideoTier)}
              className={`rounded-lg border px-4 py-3 text-left transition-all ${
                tier === t.id
                  ? "border-purple-400/40 bg-purple-500/15 text-white"
                  : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-purple-400/25 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{t.name}</span>
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                  {t.credits} cr
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {t.resolution} &middot; {t.duration}
              </p>
              {t.hasAudio && (
                <span className="mt-1 inline-block text-[10px] text-green-400/70">+ Audio</span>
              )}
            </button>
          ))}
        </div>

        {/* Prompt input */}
        <div className="mt-5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your video... e.g. 'A cinematic aerial shot of a luxury home at golden hour, drone slowly circling, warm light reflecting off windows'"
            rows={4}
            disabled={status === "queued" || status === "generating"}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/25 disabled:opacity-50"
          />
        </div>

        {/* Generate button + status */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || status === "queued" || status === "generating" || insufficientCredits}
            className="vid-cta-glow inline-flex items-center gap-3 rounded-lg bg-purple-500 px-8 py-3 text-sm font-black tracking-wide text-white uppercase transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {status === "queued" || status === "generating" ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Generate ({selectedTier.credits} credit{selectedTier.credits > 1 ? "s" : ""})
              </>
            )}
          </button>

          {insufficientCredits && status === "idle" && (
            <a href="#credits" className="text-sm font-bold text-purple-400 hover:text-purple-300">
              Buy Credits
            </a>
          )}

          {progress && (
            <p className={`text-sm ${status === "error" ? "text-red-400" : status === "done" ? "text-green-400" : "text-slate-400"}`}>
              {progress}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Result */}
        {resultUrl && status === "done" && (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/[0.06] p-4">
            <p className="mb-3 text-sm font-bold text-green-400">Video ready!</p>
            <video
              src={resultUrl}
              controls
              autoPlay
              loop
              muted={!selectedTier.hasAudio}
              className="w-full max-w-lg rounded-lg border border-slate-700"
            />
            <a
              href={resultUrl}
              download
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-300 transition hover:bg-green-500/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download MP4
            </a>
          </div>
        )}

        {/* Specs footer */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
          <span>Model: {selectedTier.modelLabel}</span>
          <span>Resolution: {selectedTier.resolution}</span>
          <span>Duration: {selectedTier.duration}</span>
          <span>Est. time: {selectedTier.estimatedTime}</span>
          <span>Backend: fal.ai Cloud GPU</span>
        </div>
      </div>
    </section>
  );
}
