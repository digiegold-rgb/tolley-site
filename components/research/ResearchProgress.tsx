"use client";

/**
 * Live progress panel for a running deep-research job: progress bar,
 * phase label, which agent/tool is working, ETA countdown, and the raw
 * step log. Pure presentation — the parent owns polling.
 */

export interface StepDetail {
  i: number;
  tool: string;
  label: string;
}

export interface JobProgress {
  status: string;
  engine?: "gemini" | "manus";
  progress: number;
  currentPhase: string | null;
  currentStep: string | null;
  stepDetails: StepDetail[] | null;
  etaRemainingSeconds: number | null;
  elapsedSeconds: number;
  errorMessage: string | null;
}

const PHASES: Array<{ key: string; label: string }> = [
  { key: "searching", label: "Searching" },
  { key: "reading", label: "Reading sources" },
  { key: "synthesizing", label: "Compiling" },
  { key: "verifying", label: "Verifying" },
  { key: "done", label: "Done" },
];

const TOOL_LABELS: Record<string, string> = {
  web_search: "web search",
  crawl4ai: "page reader",
  browser_use: "browser",
  python_execute: "synthesizer",
  terminate: "wrap-up",
  agent: "reasoning",
  gemini_grounded_search: "Google Search grounding",
  url_verifier: "citation re-fetch + quote check",
};

function fmtEta(s: number | null): string {
  if (s === null) return "estimating…";
  if (s <= 0) return "any moment now";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `~${m}m ${sec}s` : `~${sec}s`;
}

export function ResearchProgress({ job }: { job: JobProgress }) {
  const phaseIdx = Math.max(
    0,
    PHASES.findIndex((p) => p.key === (job.currentPhase ?? "searching"))
  );
  const lastSteps = (job.stepDetails ?? []).slice(-6);
  const activeTool = lastSteps.length ? lastSteps[lastSteps.length - 1].tool : "agent";

  if (job.status === "queued") {
    return (
      <Panel>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
          Waiting for a DGX slot — another research job is running. Yours starts automatically.
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      {/* Phase pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {PHASES.map((p, i) => (
          <span
            key={p.key}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              border: i === phaseIdx ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.1)",
              background: i < phaseIdx ? "rgba(6,182,212,0.12)" : i === phaseIdx ? "rgba(6,182,212,0.2)" : "rgba(0,0,0,0.25)",
              color: i <= phaseIdx ? "#67e8f9" : "rgba(255,255,255,0.35)",
            }}
          >
            {i < phaseIdx ? "✓ " : ""}
            {p.label}
          </span>
        ))}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${job.progress}%`,
            borderRadius: 999,
            background: "linear-gradient(90deg,#3b82f6,#06b6d4)",
            transition: "width 600ms ease",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 13,
          color: "rgba(255,255,255,0.75)",
        }}
      >
        <span>{job.currentStep ?? "Working…"}</span>
        <span style={{ color: "rgba(255,255,255,0.45)" }}>
          {job.progress}% · ETA {fmtEta(job.etaRemainingSeconds)}
        </span>
      </div>

      {/* Who's doing the work */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            fontSize: 11.5,
            fontWeight: 700,
            background: "rgba(59,130,246,0.15)",
            border: "1px solid rgba(59,130,246,0.35)",
            color: "#93c5fd",
          }}
        >
          {job.engine === "manus" ? "OpenManus agent · DGX Spark" : "Gemini · Google-grounded cloud"}
        </span>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            fontSize: 11.5,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          tool: {TOOL_LABELS[activeTool] ?? activeTool}
        </span>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)" }}>
          {job.elapsedSeconds}s elapsed
        </span>
      </div>

      {/* Step log */}
      {lastSteps.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11.5,
            color: "rgba(255,255,255,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {lastSteps.map((s) => (
            <div key={s.i}>
              <span style={{ color: "#67e8f9" }}>step {s.i + 1}</span> · {s.label}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </div>
  );
}
