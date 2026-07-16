"use client";

/**
 * Deep Research Search — /tv-style instant feel with an async deep lane.
 *
 * Lane 1: 420ms-debounced GET /api/research?q= — exact cache hits render
 * instantly with a ⚡ badge; partial matches show as suggestions.
 * Lane 2: Enter / "Deep research" POSTs the question, then polls
 * /api/research/[id] every 2s (manus-console pattern) driving the live
 * progress panel until the cited answer lands.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ResearchProgress, type JobProgress, type StepDetail } from "@/components/research/ResearchProgress";
import { ResearchAnswer, type AnswerData } from "@/components/research/ResearchAnswer";

interface Suggestion {
  id: string;
  query: string;
  confidence: number | null;
  completedAt: string | null;
}

interface CacheHit {
  jobId: string;
  query: string;
  confidence: number | null;
  answerMarkdown: string;
  claims: AnswerData["claims"];
  unverifiedNotes?: string;
  completedAt: string | null;
  source: "exact" | "semantic";
  similarity: number;
}

interface PolledJob extends JobProgress {
  jobId: string;
  query: string;
  confidence: number | null;
  answer: AnswerData | null;
  completedAt: string | null;
  stepDetails: StepDetail[] | null;
}

export function ResearchClient() {
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState<CacheHit | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [checking, setChecking] = useState(false);
  const [job, setJob] = useState<PolledJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Lane 1: instant lookup ──
  const runLookup = useCallback(async (q: string) => {
    if (!q.trim()) {
      setHit(null);
      setSuggestions([]);
      return;
    }
    setChecking(true);
    try {
      const r = await fetch(`/api/research?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (r.ok) {
        setHit(data.hit ?? null);
        setSuggestions(data.suggestions ?? []);
      }
    } catch {
      // instant lane is best-effort
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runLookup(query), 420);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, runLookup]);

  // ── Lane 2: deep research ──
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/research/${jobId}`);
        if (!r.ok) return;
        const data: PolledJob = await r.json();
        setJob(data);
        if (data.status === "completed" || data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // transient poll errors are fine
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function submitDeep() {
    const q = query.trim();
    if (!q || submitting) return;
    setSubmitting(true);
    setError("");
    setJob(null);
    try {
      const r = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Failed to start research");
        return;
      }
      setJob({
        jobId: data.jobId,
        query: q,
        status: data.status ?? "queued",
        progress: 0,
        currentPhase: "searching",
        currentStep: "Starting up",
        stepDetails: null,
        etaRemainingSeconds: null,
        elapsedSeconds: 0,
        errorMessage: null,
        confidence: null,
        answer: null,
        completedAt: null,
      });
      startPolling(data.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadSuggestion(id: string) {
    // A suggestion is a completed job — one poll fetch returns its answer.
    try {
      const r = await fetch(`/api/research/${id}`);
      if (!r.ok) return;
      const data: PolledJob = await r.json();
      setJob(data);
    } catch {
      // ignore
    }
  }

  const isRunning =
    job && job.status !== "completed" && job.status !== "failed";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 50% -10%, #0a1a2e 0%, #070d18 55%, #05070c 100%)",
        color: "white",
        fontFamily: "system-ui, sans-serif",
        padding: "40px 16px 80px",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
            🔬 Deep Research
          </h1>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
            Ask anything. Known answers are instant — new questions get a live,
            source-verified research run on the DGX.
          </p>
        </div>

        {/* Search bar */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !hit) submitDeep();
            }}
            placeholder='e.g. "Who makes NBR polymer similar to DN2850?"'
            autoFocus
            style={{
              flex: "1 1 340px",
              padding: "14px 18px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "white",
              fontSize: 15.5,
              outline: "none",
            }}
          />
          <button
            onClick={submitDeep}
            disabled={submitting || !query.trim() || Boolean(isRunning)}
            style={{
              padding: "14px 22px",
              borderRadius: 14,
              border: "none",
              background:
                submitting || isRunning
                  ? "#1e3a5f"
                  : "linear-gradient(90deg,#3b82f6,#06b6d4)",
              color: "white",
              fontWeight: 800,
              fontSize: 14.5,
              cursor: submitting || isRunning ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {submitting ? "Starting…" : isRunning ? "Researching…" : "Deep research"}
          </button>
        </div>

        {/* Lane-1 status line */}
        <div style={{ minHeight: 20, fontSize: 12.5, color: "rgba(255,255,255,0.35)", marginBottom: 18 }}>
          {checking
            ? "Checking past research…"
            : hit
              ? "⚡ Found a previously verified answer — shown below instantly."
              : query.trim()
                ? "No cached answer — hit Enter or “Deep research” to run a live investigation."
                : ""}
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#fca5a5",
              fontSize: 13.5,
              marginBottom: 18,
            }}
          >
            {error}{" "}
            <button
              onClick={submitDeep}
              style={{
                marginLeft: 8,
                background: "none",
                border: "1px solid rgba(252,165,165,0.4)",
                borderRadius: 8,
                color: "#fca5a5",
                padding: "3px 10px",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              retry
            </button>
          </div>
        )}

        {/* Instant cache hit */}
        {hit && !job && (
          <ResearchAnswer
            answer={{
              answerMarkdown: hit.answerMarkdown,
              claims: hit.claims,
              unverifiedNotes: hit.unverifiedNotes,
            }}
            confidence={hit.confidence}
            cached
            similarity={hit.similarity}
            completedAt={hit.completedAt}
          />
        )}

        {/* Suggestions */}
        {!hit && !job && suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            <span style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.3)" }}>
              Related past research
            </span>
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSuggestion(s.id)}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                ⚡ {s.query}
                {s.confidence !== null && (
                  <span style={{ marginLeft: 8, fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>
                    {s.confidence}/100
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Live job */}
        {job && isRunning && <ResearchProgress job={job} />}

        {job && job.status === "failed" && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#fca5a5",
              fontSize: 13.5,
            }}
          >
            <strong>Research failed:</strong> {job.errorMessage ?? "unknown error"}
            <button
              onClick={() => {
                setJob(null);
                submitDeep();
              }}
              style={{
                marginLeft: 10,
                background: "none",
                border: "1px solid rgba(252,165,165,0.4)",
                borderRadius: 8,
                color: "#fca5a5",
                padding: "3px 10px",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              retry
            </button>
          </div>
        )}

        {job && job.status === "completed" && job.answer && (
          <ResearchAnswer
            answer={job.answer}
            confidence={job.confidence}
            completedAt={job.completedAt}
          />
        )}
      </div>
    </div>
  );
}
