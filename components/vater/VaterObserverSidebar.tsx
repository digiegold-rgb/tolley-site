"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Note = {
  id: string;
  jobId: string;
  projectId: string | null;
  text: string;
  createdAt: string;
};

type Proposal = {
  id: string;
  jobId: string;
  projectId: string | null;
  actionType: string;
  params: Record<string, unknown> | unknown;
  reasoning: string;
  status: "pending" | "applied" | "dismissed" | "failed";
  createdAt: string;
  resolvedAt: string | null;
  resultSummary: string | null;
};

type FeedItem =
  | ({ kind: "note" } & Note)
  | ({ kind: "proposal" } & Proposal);

const COLLAPSE_KEY = "vater:observer:collapsed:v1";

/**
 * Live audit sidebar for the Vater watcher. Opens an SSE to
 * /api/vater/observer/stream and renders the newest-first feed of notes
 * and proposal cards with Apply / Dismiss.
 */
export function VaterObserverSidebar({
  activeJobId,
}: {
  activeJobId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [scope, setScope] = useState<"active" | "all">(
    activeJobId ? "active" : "all",
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [connected, setConnected] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    if (scope === "active" && !activeJobId) setScope("all");
  }, [scope, activeJobId]);

  const streamJobId = scope === "active" && activeJobId ? activeJobId : "all";

  const loadBackfill = useCallback(async (jobId: string) => {
    const [nRes, pRes] = await Promise.all([
      fetch(`/api/vater/observer/notes?jobId=${jobId}&limit=60`, {
        credentials: "include",
      }),
      fetch(`/api/vater/observer/proposals?jobId=${jobId}&limit=60`, {
        credentials: "include",
      }),
    ]);
    if (nRes.ok) {
      const { notes: ns } = await nRes.json();
      setNotes(ns as Note[]);
    }
    if (pRes.ok) {
      const { proposals: ps } = await pRes.json();
      setProposals(ps as Proposal[]);
    }
  }, []);

  useEffect(() => {
    loadBackfill(streamJobId);
  }, [streamJobId, loadBackfill]);

  useEffect(() => {
    if (collapsed) return;
    const es = new EventSource(
      `/api/vater/observer/stream?jobId=${encodeURIComponent(streamJobId)}`,
      { withCredentials: true },
    );
    sourceRef.current = es;

    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("hello", () => setConnected(true));
    es.addEventListener("note", (ev) => {
      try {
        const n = JSON.parse((ev as MessageEvent).data) as Note;
        setNotes((prev) => [n, ...prev].slice(0, 300));
      } catch {}
    });
    es.addEventListener("proposal", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data) as Proposal;
        setProposals((prev) => {
          const without = prev.filter((x) => x.id !== p.id);
          return [p, ...without].slice(0, 200);
        });
      } catch {}
    });
    es.addEventListener("proposal_resolved", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent).data) as Proposal;
        setProposals((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      } catch {}
    });
    es.addEventListener("bye", () => {
      setConnected(false);
      es.close();
      // Let EventSource re-init by toggling scope state on the next tick
      setTimeout(() => {
        setScope((s) => s);
      }, 500);
    });
    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [streamJobId, collapsed]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    for (const n of notes) items.push({ kind: "note", ...n });
    for (const p of proposals) items.push({ kind: "proposal", ...p });
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items.slice(0, 300);
  }, [notes, proposals]);

  const pendingCount = proposals.filter((p) => p.status === "pending").length;

  async function applyProposal(id: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/vater/observer/proposals/${id}/apply`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Apply failed: ${data.error || res.status}`);
      }
    } finally {
      setActingId(null);
    }
  }

  async function dismissProposal(id: string) {
    setActingId(id);
    try {
      const res = await fetch(
        `/api/vater/observer/proposals/${id}/dismiss`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Dismiss failed: ${data.error || res.status}`);
      }
    } finally {
      setActingId(null);
    }
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed right-0 top-40 z-40 flex -translate-x-0 items-center gap-2 rounded-l-lg border border-r-0 border-white/15 bg-[#0a0914] px-3 py-2 text-xs text-white/70 shadow-lg hover:bg-white/5"
        aria-label="Open Watcher"
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            connected ? "bg-emerald-400" : "bg-white/30"
          }`}
        />
        Watcher
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-16 z-40 flex h-[calc(100vh-6rem)] w-[360px] flex-col border-l border-white/10 bg-[#06050a]/95 shadow-2xl backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-emerald-400" : "bg-amber-400"
            }`}
            title={connected ? "Live" : "Reconnecting..."}
          />
          <span className="text-sm font-semibold text-white">Watcher</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              {pendingCount} open
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border border-white/10 text-[10px]">
            <button
              onClick={() => setScope("active")}
              disabled={!activeJobId}
              className={`px-2 py-1 ${
                scope === "active"
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-white/50 hover:text-white/80"
              } disabled:opacity-30`}
            >
              This job
            </button>
            <button
              onClick={() => setScope("all")}
              className={`px-2 py-1 ${
                scope === "all"
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              All
            </button>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white"
            aria-label="Collapse"
          >
            →
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {feed.length === 0 ? (
          <p className="mt-4 px-2 text-center text-xs text-white/30">
            Watcher is listening. Notes and proposals will appear here as jobs
            run.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {feed.map((item) =>
              item.kind === "note" ? (
                <li
                  key={`n-${item.id}`}
                  className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5"
                >
                  <p className="whitespace-pre-wrap text-[12px] text-white/80">
                    {item.text}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-wide text-white/30">
                    {formatTime(item.createdAt)} · job{" "}
                    {item.jobId.slice(0, 8)}
                  </p>
                </li>
              ) : (
                <li
                  key={`p-${item.id}`}
                  className={`rounded-md border px-2.5 py-2 ${
                    item.status === "pending"
                      ? "border-amber-500/40 bg-amber-500/[0.06]"
                      : item.status === "applied"
                        ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                        : item.status === "failed"
                          ? "border-red-500/40 bg-red-500/[0.06]"
                          : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/80">
                      {item.actionType.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase ${
                        item.status === "pending"
                          ? "text-amber-400"
                          : item.status === "applied"
                            ? "text-emerald-400"
                            : item.status === "failed"
                              ? "text-red-400"
                              : "text-white/40"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[12px] text-white/85">
                    {item.reasoning}
                  </p>
                  {hasParams(item.params) && (
                    <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-1.5 text-[10px] text-white/60">
                      {JSON.stringify(item.params, null, 2)}
                    </pre>
                  )}
                  {item.resultSummary && (
                    <p className="mt-1 rounded bg-black/30 px-1.5 py-1 text-[10px] text-white/70">
                      {item.resultSummary}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] text-white/30">
                      {formatTime(item.createdAt)} · job{" "}
                      {item.jobId.slice(0, 8)}
                    </span>
                    {item.status === "pending" && (
                      <div className="flex gap-1">
                        <button
                          disabled={actingId === item.id}
                          onClick={() => applyProposal(item.id)}
                          className="rounded bg-emerald-500/25 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/40 disabled:opacity-50"
                        >
                          Apply
                        </button>
                        <button
                          disabled={actingId === item.id}
                          onClick={() => dismissProposal(item.id)}
                          className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/15 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <footer className="border-t border-white/10 px-2 py-1.5 text-[10px] text-white/40">
        {connected ? "Live" : "Reconnecting…"} · {feed.length} items
      </footer>
    </aside>
  );
}

function hasParams(p: unknown): boolean {
  return (
    !!p &&
    typeof p === "object" &&
    !Array.isArray(p) &&
    Object.keys(p as Record<string, unknown>).length > 0
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
