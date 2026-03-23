"use client";

import { useState } from "react";

type Tactic = {
  id: string;
  category: string;
  title: string;
  description: string;
  impactLow: number;
  impactHigh: number;
  cost: string;
  difficulty: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  steps: string[];
  bureaus: string[];
};

const categoryConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  free: {
    label: "FREE",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  low_cost: {
    label: "LOW COST",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
  },
  legal: {
    label: "LEGAL",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
};

const difficultyBadge: Record<string, string> = {
  easy: "text-green-400",
  medium: "text-yellow-400",
  hard: "text-red-400",
};

export function TacticsChecklist({ tactics }: { tactics?: Tactic[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  if (!tactics || tactics.length === 0) return null;

  const completed = tactics.filter((t) => t.status === "completed").length;
  const progressPct = Math.round((completed / tactics.length) * 100);

  const grouped = {
    free: tactics.filter((t) => t.category === "free"),
    low_cost: tactics.filter((t) => t.category === "low_cost"),
    legal: tactics.filter((t) => t.category === "legal"),
  };

  const toggleStatus = async (tactic: Tactic) => {
    const nextStatus =
      tactic.status === "not_started"
        ? "in_progress"
        : tactic.status === "in_progress"
          ? "completed"
          : "not_started";
    setUpdating(tactic.id);
    try {
      await fetch("/api/credit/tactics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tacticId: tactic.id, status: nextStatus }),
      });
      tactic.status = nextStatus;
    } catch {}
    setUpdating(null);
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return "✓";
    if (status === "in_progress") return "◐";
    return "○";
  };

  const statusColor = (status: string) => {
    if (status === "completed") return "text-green-400";
    if (status === "in_progress") return "text-[#00d4ff]";
    return "text-white/30";
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
          Credit Improvement Tactics
        </h3>
        <span className="text-xs text-white/50">
          {completed}/{tactics.length} done
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#00d4ff] to-green-400 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {Object.entries(grouped).map(
        ([cat, items]) =>
          items.length > 0 && (
            <div key={cat} className="mb-4">
              <h4
                className={`mb-2 text-xs font-bold uppercase tracking-wider ${categoryConfig[cat]?.color || "text-white/50"}`}
              >
                {categoryConfig[cat]?.label || cat} ({items.filter((t) => t.status === "completed").length}/{items.length})
              </h4>
              <div className="space-y-2">
                {items.map((tactic) => (
                  <div
                    key={tactic.id}
                    className={`rounded-xl border p-3 transition-all ${categoryConfig[cat]?.bg || "border-white/10 bg-white/5"} ${tactic.status === "completed" ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleStatus(tactic)}
                        disabled={updating === tactic.id}
                        className={`mt-0.5 text-lg leading-none ${statusColor(tactic.status)} hover:opacity-80`}
                      >
                        {statusIcon(tactic.status)}
                      </button>
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() =>
                          setExpandedId(
                            expandedId === tactic.id ? null : tactic.id
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${tactic.status === "completed" ? "text-white/40 line-through" : "text-white"}`}
                          >
                            {tactic.title}
                          </span>
                          <span
                            className={`text-xs ${difficultyBadge[tactic.difficulty] || "text-white/40"}`}
                          >
                            {tactic.difficulty}
                          </span>
                        </div>
                        <div className="mt-0.5 flex gap-3 text-xs text-white/40">
                          <span>
                            +{tactic.impactLow}-{tactic.impactHigh} pts
                          </span>
                          <span>{tactic.cost}</span>
                          {tactic.bureaus.length > 0 && (
                            <span>
                              {tactic.bureaus
                                .map((b) => b.slice(0, 2).toUpperCase())
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedId === tactic.id && (
                      <div className="mt-3 border-t border-white/10 pt-3">
                        <p className="mb-2 text-xs text-white/50">
                          {tactic.description}
                        </p>
                        <ol className="space-y-1">
                          {tactic.steps.map((step, i) => (
                            <li
                              key={i}
                              className="flex gap-2 text-xs text-white/60"
                            >
                              <span className="shrink-0 text-white/30">
                                {i + 1}.
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                        {tactic.notes && (
                          <p className="mt-2 text-xs italic text-yellow-400/60">
                            Note: {tactic.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
