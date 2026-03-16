"use client";

import { useState, useEffect, useCallback } from "react";

interface Phase {
  id: string;
  phase: string;
  message: string;
  fullTitle: string;
  timestamp: string;
}

interface ProgressData {
  running: boolean;
  runId: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  status: string;
  itemsFound: number;
  alertsGen: number;
  error: string | null;
  phases: Phase[];
  summary: Record<string, unknown> | null;
}

const PHASE_ORDER = [
  "INIT",
  "EBAY_NICHE",
  "GOOGLE",
  "REDDIT",
  "UNCONVENTIONAL",
  "ALIBABA",
  "LIQUIDATION",
  "AI_SYNTHESIS",
  "SNAPSHOTS",
  "MARGINS",
  "STALE",
  "LOTS",
  "COMPLETE",
];

const PHASE_LABELS: Record<string, { icon: string; label: string }> = {
  INIT: { icon: "🚀", label: "Initializing" },
  EBAY_NICHE: { icon: "🔍", label: "Niche eBay Sold" },
  GOOGLE: { icon: "📈", label: "Google Trends" },
  REDDIT: { icon: "💬", label: "Reddit Intel" },
  UNCONVENTIONAL: { icon: "🏛️", label: "Hidden Sources" },
  ALIBABA: { icon: "🌏", label: "Alibaba Forecast" },
  LIQUIDATION: { icon: "📦", label: "Liquidation Sites" },
  AI_SYNTHESIS: { icon: "🤖", label: "AI Cross-Reference" },
  SNAPSHOTS: { icon: "📸", label: "Price Snapshots" },
  MARGINS: { icon: "💹", label: "Margin Check" },
  STALE: { icon: "⏳", label: "Stale Inventory" },
  LOTS: { icon: "📊", label: "Lot P&L" },
  COMPLETE: { icon: "✅", label: "Complete" },
};

export function ScanProgress({ onComplete }: { onComplete?: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/scan-progress");
      if (res.ok) {
        const data: ProgressData = await res.json();
        setProgress(data);

        if (!data.running && polling) {
          setPolling(false);
          setScanning(false);
          if (data.status === "complete") {
            onComplete?.();
          }
        }
      }
    } catch {
      // silent
    }
  }, [polling, onComplete]);

  useEffect(() => {
    // Check if there's already a running scan
    poll();
  }, []);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [polling, poll]);

  async function startScan() {
    setScanning(true);
    setError("");
    setPolling(true);

    try {
      // Fire and forget — we'll poll for progress
      fetch("/api/cron/shop-intelligence", {
        method: "POST",
      }).catch(() => {
        // The request may timeout but the scan continues server-side
      });

      // Start polling immediately
      setTimeout(poll, 1000);
    } catch (e) {
      setError(String(e));
      setScanning(false);
      setPolling(false);
    }
  }

  // Determine which phases are done
  const completedPhases = new Set(progress?.phases.map((p) => p.phase) || []);
  const latestPhase = progress?.phases[progress.phases.length - 1];
  const isRunning = scanning || progress?.running;

  const phasesCompleted = PHASE_ORDER.filter((p) => completedPhases.has(p)).length;
  const progressPercent = Math.round((phasesCompleted / PHASE_ORDER.length) * 100);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/60">Turbo Scanner</h3>
        <button
          onClick={startScan}
          disabled={!!isRunning}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            isRunning
              ? "bg-purple-500/10 text-purple-400/50 border border-purple-500/20 cursor-not-allowed"
              : "shop-btn-primary"
          }`}
        >
          {isRunning ? "Scanning..." : "Run Now"}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Progress bar */}
      {isRunning && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/30">
              {latestPhase ? PHASE_LABELS[latestPhase.phase]?.label || latestPhase.phase : "Starting..."}
            </span>
            <span className="text-xs text-purple-400">{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-500"
              style={{ width: `${Math.max(progressPercent, 3)}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase list */}
      {(isRunning || (progress && progress.phases.length > 0)) && (
        <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
          {PHASE_ORDER.map((phaseKey) => {
            const phaseInfo = PHASE_LABELS[phaseKey];
            const isDone = completedPhases.has(phaseKey);
            const phaseData = progress?.phases.filter((p) => p.phase === phaseKey);
            const lastMessage = phaseData?.[phaseData.length - 1]?.message;
            const isCurrent = isRunning && !isDone && latestPhase &&
              PHASE_ORDER.indexOf(phaseKey) === PHASE_ORDER.indexOf(latestPhase.phase) + 1;

            if (!isDone && !isCurrent && !isRunning) return null;

            return (
              <div
                key={phaseKey}
                className={`flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs transition ${
                  isDone
                    ? "bg-white/[0.02]"
                    : isCurrent
                      ? "bg-purple-500/5 border border-purple-500/20"
                      : "opacity-30"
                }`}
              >
                <span className="mt-0.5 text-sm">
                  {isDone ? phaseInfo?.icon || "✓" : isCurrent ? "⏳" : "○"}
                </span>
                <div className="min-w-0 flex-1">
                  <span className={`font-medium ${isDone ? "text-white/50" : "text-white/30"}`}>
                    {phaseInfo?.label || phaseKey}
                  </span>
                  {lastMessage && (
                    <p className="text-white/25 truncate mt-0.5">{lastMessage}</p>
                  )}
                </div>
                {isDone && <span className="text-green-500/40 mt-0.5">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary when complete */}
      {progress && progress.status === "complete" && !isRunning && (
        <div className="mt-3 rounded-lg bg-green-500/5 border border-green-500/15 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">✓</span>
            <span className="text-xs text-green-400/80">Scan complete</span>
            {progress.duration && (
              <span className="text-[0.6rem] text-white/20">
                {Math.round(progress.duration / 1000)}s
              </span>
            )}
          </div>
          <div className="mt-1 flex gap-3 text-[0.65rem] text-white/30">
            <span>{progress.itemsFound} found</span>
            <span>{progress.alertsGen} alerts</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {progress && progress.status === "failed" && !isRunning && (
        <div className="mt-3 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2">
          <span className="text-xs text-red-400">Scan failed: {progress.error}</span>
        </div>
      )}
    </div>
  );
}
