"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Task {
  id: string;
  prompt: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string | null;
  error: string | null;
  steps: string[];
  created_at: string;
  completed_at: string | null;
}

export function ManusConsole() {
  const [prompt, setPrompt] = useState("");
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<Task[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load task history on mount
  useEffect(() => {
    fetch("/api/manus")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(() => {});
  }, []);

  // Poll for task updates
  const startPolling = useCallback((taskId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/manus?id=${taskId}`);
        if (!res.ok) return;
        const task: Task = await res.json();
        setCurrentTask(task);

        if (task.status === "completed" || task.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          // Refresh history
          fetch("/api/manus")
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data)) setHistory(data);
            })
            .catch(() => {});
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [currentTask?.steps, currentTask?.result]);

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setViewingTask(null);

    try {
      const res = await fetch("/api/manus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setCurrentTask({
          id: "err",
          prompt: prompt.trim(),
          status: "failed",
          result: null,
          error: err.error || "Failed to submit task",
          steps: [],
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
        return;
      }

      const task: Task = await res.json();
      setCurrentTask(task);
      setPrompt("");
      startPolling(task.id);
    } catch (err: any) {
      setCurrentTask({
        id: "err",
        prompt: prompt.trim(),
        status: "failed",
        result: null,
        error: err.message || "Network error",
        steps: [],
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const displayTask = viewingTask || currentTask;
  const isActive =
    displayTask?.status === "pending" || displayTask?.status === "running";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          <span className="text-[#00ff88]">manus</span>
          <span className="text-white/30">.tolley.io</span>
        </h1>
        <p className="text-sm text-white/30">
          Autonomous AI agent — give it a task, walk away, get results
        </p>
      </div>

      {/* Terminal */}
      <div className="manus-terminal">
        {/* Title bar */}
        <div className="manus-titlebar">
          <div className="manus-dot manus-dot-red" />
          <div className="manus-dot manus-dot-yellow" />
          <div className="manus-dot manus-dot-green" />
          <span className="manus-titlebar-text">
            openmanus @ dgx-spark
          </span>
          {displayTask && (
            <span
              className={`manus-status manus-status-${displayTask.status} ${isActive ? "manus-pulse" : ""}`}
            >
              {displayTask.status}
            </span>
          )}
        </div>

        {/* Input */}
        <div className="manus-input-area">
          <div className="manus-prompt-label">
            <span style={{ color: "#00ff88" }}>$</span>
            <span>task prompt</span>
          </div>
          <textarea
            className="manus-textarea"
            placeholder="Research the top 3 real estate CRMs and create a comparison table..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <button
              className="manus-submit"
              onClick={handleSubmit}
              disabled={submitting || !prompt.trim()}
            >
              {submitting ? (
                <>
                  <span className="manus-pulse">submitting</span>
                </>
              ) : (
                <>execute task</>
              )}
            </button>
            <span className="text-xs text-white/20">
              {"\u2318"}+Enter to submit
            </span>
          </div>
        </div>

        {/* Output */}
        {displayTask && (
          <div className="manus-output" ref={outputRef}>
            <div className="manus-step">
              <div className="manus-step-label">TASK</div>
              <div className="text-white/90">{displayTask.prompt}</div>
            </div>

            {displayTask.steps.map((step, i) => (
              <div key={i} className="manus-step">
                <div className="manus-step-label">STEP {i + 1}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{step}</div>
              </div>
            ))}

            {displayTask.error && (
              <div className="manus-step">
                <div
                  className="manus-step-label"
                  style={{ color: "#ff5050" }}
                >
                  ERROR
                </div>
                <div style={{ color: "#ff5050" }}>{displayTask.error}</div>
              </div>
            )}

            {displayTask.status === "completed" && displayTask.result && (
              <div className="manus-step">
                <div
                  className="manus-step-label"
                  style={{ color: "#00ff88" }}
                >
                  COMPLETE
                </div>
                <div
                  className="text-white/80"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {displayTask.result}
                </div>
              </div>
            )}

            {isActive && (
              <div className="manus-step">
                <div className="manus-step-label manus-pulse">
                  PROCESSING
                </div>
                <div className="text-white/40">
                  Agent is working
                  <span className="manus-cursor" />
                </div>
              </div>
            )}
          </div>
        )}

        {!displayTask && (
          <div className="manus-output flex items-center justify-center">
            <p className="text-sm text-white/15">
              No active task. Enter a prompt above.
            </p>
          </div>
        )}
      </div>

      {/* Task History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/25">
            Recent Tasks
          </h2>
          <div className="space-y-2">
            {history.map((task) => (
              <div
                key={task.id}
                className="manus-history-item"
                onClick={() => {
                  setViewingTask(task);
                  if (
                    task.status === "pending" ||
                    task.status === "running"
                  ) {
                    setCurrentTask(task);
                    startPolling(task.id);
                  }
                }}
              >
                <div className="manus-history-prompt">{task.prompt}</div>
                <div className="manus-history-meta">
                  <span
                    className={`manus-status manus-status-${task.status}`}
                  >
                    {task.status}
                  </span>
                  <span>
                    {new Date(task.created_at).toLocaleString()}
                  </span>
                  <span>id: {task.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
