"use client";

import { useState, useEffect, useCallback } from "react";

interface Generation {
  id: string;
  prompt: string;
  model: string;
  tier: string;
  status: string;
  creditsUsed: number;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  durationSecs: number | null;
  resolution: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  generating: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  completed: "border-green-500/40 bg-green-500/10 text-green-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
};

const TIER_LABELS: Record<string, string> = {
  basic: "Basic",
  cinematic: "Cinematic",
  premium: "Premium",
  ultra: "Ultra",
};

export function VideoHistory() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/video/history?page=${p}&limit=12`);
      const data = await res.json();
      setGenerations(data.generations);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  if (loading && generations.length === 0) {
    return null;
  }

  if (total === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight text-white uppercase">
          Generation History
        </h2>
        <span className="text-sm text-slate-500">{total} total</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {generations.map((gen) => (
          <div
            key={gen.id}
            className="rounded-xl border border-slate-700/60 bg-slate-800/30 overflow-hidden transition hover:border-purple-400/25"
          >
            {/* Video preview / thumbnail */}
            {gen.status === "completed" && gen.outputUrl ? (
              <video
                src={gen.outputUrl}
                className="h-40 w-full object-cover bg-black"
                muted
                loop
                playsInline
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
            ) : (
              <div className="flex h-40 items-center justify-center bg-slate-900/50">
                {gen.status === "generating" || gen.status === "queued" ? (
                  <svg className="h-8 w-8 animate-spin text-purple-400/50" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-8 w-8 text-red-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                )}
              </div>
            )}

            <div className="p-4">
              {/* Status + tier badges */}
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[gen.status] || STATUS_COLORS.failed}`}>
                  {gen.status}
                </span>
                <span className="rounded-full border border-purple-400/20 bg-purple-400/[0.06] px-2 py-0.5 text-[10px] font-bold text-purple-300/80">
                  {TIER_LABELS[gen.tier] || gen.tier}
                </span>
                <span className="ml-auto text-[10px] text-slate-600">
                  {gen.creditsUsed} cr
                </span>
              </div>

              {/* Prompt */}
              <p className="mt-2 line-clamp-2 text-sm text-slate-300">{gen.prompt}</p>

              {/* Meta row */}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                {gen.resolution && <span>{gen.resolution}</span>}
                {gen.durationSecs && <span>{gen.durationSecs.toFixed(1)}s</span>}
                <span>{new Date(gen.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              {gen.status === "completed" && gen.outputUrl && (
                <a
                  href={gen.outputUrl}
                  download
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-300 transition hover:bg-green-500/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                </a>
              )}

              {gen.status === "failed" && gen.errorMessage && (
                <p className="mt-2 text-xs text-red-400/70 line-clamp-1">{gen.errorMessage}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => fetchHistory(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition hover:border-purple-400/30 disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-sm text-slate-500">
            {page} / {pages}
          </span>
          <button
            onClick={() => fetchHistory(page + 1)}
            disabled={page >= pages}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition hover:border-purple-400/30 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
