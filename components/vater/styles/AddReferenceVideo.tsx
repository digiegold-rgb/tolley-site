"use client";

import { useState, useCallback } from "react";

export function AddReferenceVideo({
  styleId,
  onComplete,
}: {
  styleId: string;
  onComplete: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setPhase("starting");
    try {
      const r = await fetch(`/api/vater/youtube/styles/${styleId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url.trim()] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || data?.detail || `HTTP ${r.status}`);
      setJobId(data.jobId);
      setPhase("transcribing");
      // Poll: transcribe is slow (~2-8min). Poll every 6s up to 15min.
      const start = Date.now();
      const TIMEOUT_MS = 15 * 60 * 1000;
      while (Date.now() - start < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 6000));
        const pr = await fetch(
          `/api/vater/autopilot/jobs/${data.jobId}`,
          { cache: "no-store" },
        ).catch(() => null);
        if (pr?.ok) {
          const pj = await pr.json();
          setPhase(pj.phase || "running");
          if (pj.status === "done") break;
          if (pj.status === "failed") {
            throw new Error(pj.error || "transcribe failed");
          }
        }
      }
      setUrl("");
      setJobId(null);
      setPhase("");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }, [url, styleId, onComplete]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
        disabled={busy}
        className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !url.trim()}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? phase || "Working…" : "+ Add"}
      </button>
      {error && (
        <div className="w-full rounded-md border border-rose-900 bg-rose-950/30 p-2 text-xs text-rose-300">
          {error}
        </div>
      )}
      {jobId && busy && (
        <div className="w-full text-xs text-zinc-500">
          Job {jobId.slice(0, 8)} · phase: {phase}
        </div>
      )}
    </div>
  );
}
