"use client";

import { useEffect, useRef, useState } from "react";

interface BackfillProgress {
  total: number;
  sent: number;
  ok: number;
  failed: number;
  done: boolean;
  startedAt: string;
  error?: string;
}

export function FbBackfillCard() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BackfillProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollOnce(id: string) {
    try {
      const res = await fetch(
        `/api/shop/admin/backfill-sold?id=${encodeURIComponent(id)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg({ kind: "err", text: `Poll failed: ${body.error || res.status}` });
        if (res.status === 404) stopPolling();
        return;
      }
      const data: BackfillProgress = await res.json();
      setProgress(data);
      if (data.done) {
        stopPolling();
        setMsg({
          kind: data.error ? "err" : "ok",
          text: data.error
            ? `Backfill ended with error: ${data.error}`
            : `Backfill complete — ${data.ok} created, ${data.failed} failed.`,
        });
      }
    } catch (err) {
      setMsg({
        kind: "err",
        text: `Poll error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  async function startBackfill() {
    setBusy(true);
    setMsg(null);
    setProgress(null);
    try {
      const res = await fetch("/api/shop/admin/backfill-sold", { method: "POST" });
      const data = await res.json();
      if (res.status === 409) {
        if (data.jobId) {
          setJobId(data.jobId);
          setMsg({ kind: "ok", text: "Adopting in-progress backfill." });
          stopPolling();
          pollRef.current = window.setInterval(() => pollOnce(data.jobId), 5000);
          pollOnce(data.jobId);
        }
      } else if (!res.ok) {
        setMsg({ kind: "err", text: `Start failed: ${data.error || res.status}` });
      } else if (data.jobId) {
        setJobId(data.jobId);
        setMsg({ kind: "ok", text: "Backfill started." });
        stopPolling();
        pollRef.current = window.setInterval(() => pollOnce(data.jobId), 5000);
        pollOnce(data.jobId);
      } else {
        setMsg({ kind: "err", text: "Unexpected response — no jobId" });
      }
    } catch (err) {
      setMsg({
        kind: "err",
        text: `Start error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
    setBusy(false);
  }

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.sent / progress.total) * 100))
      : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Backfill sold from FB</p>
          <p className="mt-0.5 text-xs text-white/40">
            One-shot import of Ruthann&apos;s historical sold listings into /shop/sold.
          </p>
        </div>
        <button
          onClick={startBackfill}
          disabled={busy || (!!progress && !progress.done)}
          className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-purple-500/30 disabled:opacity-40"
        >
          {busy ? "Starting…" : progress && !progress.done ? "Running…" : "Start backfill"}
        </button>
      </div>

      {progress && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs text-white/60">
            <div><p className="text-white/40">Total</p><p className="text-base font-semibold text-white">{progress.total}</p></div>
            <div><p className="text-white/40">Sent</p><p className="text-base font-semibold text-white">{progress.sent}</p></div>
            <div><p className="text-white/40">Created</p><p className="text-base font-semibold text-green-400">{progress.ok}</p></div>
            <div><p className="text-white/40">Failed</p><p className="text-base font-semibold text-red-400">{progress.failed}</p></div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-purple-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-white/30">
            Job {(jobId || progress.startedAt).slice(0, 12)}…
            {progress.done ? " · done" : " · polling every 5s"}
          </p>
        </div>
      )}

      {msg && (
        <p className={`mt-2 text-xs ${msg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
