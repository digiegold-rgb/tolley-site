"use client";

import { useState, useCallback } from "react";

export function AddCharacter({
  styleId,
  onComplete,
}: {
  styleId: string;
  onComplete: () => void;
}) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!name.trim() || brief.trim().length < 8) {
      setError("Need a name and at least 8 chars of brief");
      return;
    }
    setBusy(true);
    setError(null);
    setPhase("starting");
    try {
      const r = await fetch(`/api/vater/youtube/styles/${styleId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), brief: brief.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      const jobId = data.jobId as string;
      setPhase("describing");
      // Character gen runs ~12-90s. Poll every 4s up to 5min.
      const start = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000;
      while (Date.now() - start < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 4000));
        const pr = await fetch(`/api/vater/autopilot/jobs/${jobId}`, { cache: "no-store" }).catch(() => null);
        if (pr?.ok) {
          const pj = await pr.json();
          setPhase(pj.phase || "running");
          if (pj.status === "done") break;
          if (pj.status === "failed") throw new Error(pj.error || "character gen failed");
        }
      }
      setName("");
      setBrief("");
      setPhase("");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }, [name, brief, styleId, onComplete]);

  return (
    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Character name (e.g. The Everyman Spender)"
          disabled={busy}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
        />
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Brief: middle-aged man in a blue suit, anxious"
          disabled={busy}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500 sm:col-span-2"
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Qwen writes a 400-800 char hex-coded descriptor. SDXL renders the
          reference image. ~15-90s.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim() || brief.trim().length < 8}
          className="rounded-md bg-sky-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? phase || "Working…" : "Generate Character"}
        </button>
      </div>
      {error && (
        <div className="rounded-md border border-rose-900 bg-rose-950/30 p-2 text-xs text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}
