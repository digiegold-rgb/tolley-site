"use client";

import { useState } from "react";

interface SequenceStep {
  id: string;
  stepNumber: number;
  delayDays: number;
  delayHours: number;
  promptId: string | null;
  templateBody: string | null;
  isAiGenerated: boolean;
}

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  targetSource: string[];
  steps: SequenceStep[];
  enrollmentStats: Record<string, number>;
  _count: { enrollments: number };
  createdAt: string;
}

interface Props {
  sequences: Sequence[];
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onEnroll: (id: string) => void;
}

const statusColors: Record<string, string> = {
  active: "text-blue-300",
  replied: "text-green-300",
  completed: "text-white/40",
  paused: "text-yellow-300",
  opted_out: "text-red-300",
};

export default function SequenceList({ sequences, onToggle, onDelete, onEnroll }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sequences.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-sm">
        No sequences yet. Create your first drip campaign above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sequences.map((seq) => {
        const totalEnrolled = seq._count.enrollments;
        const stats = seq.enrollmentStats;
        const isExpanded = expandedId === seq.id;

        return (
          <div
            key={seq.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : seq.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${seq.isActive ? "bg-green-400" : "bg-white/20"}`} />
                <div className="text-left">
                  <div className="text-sm font-medium text-white/80">{seq.name}</div>
                  <div className="text-xs text-white/30">
                    {seq.steps.length} steps &middot; {totalEnrolled} enrolled
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Quick stats */}
                {totalEnrolled > 0 && (
                  <div className="flex gap-2 text-[10px]">
                    {stats.active && <span className="text-blue-300">{stats.active} active</span>}
                    {stats.replied && <span className="text-green-300">{stats.replied} replied</span>}
                    {stats.completed && <span className="text-white/40">{stats.completed} done</span>}
                  </div>
                )}
                <svg
                  className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-white/10 px-4 py-3 space-y-3">
                {seq.description && (
                  <p className="text-xs text-white/40">{seq.description}</p>
                )}

                {/* Steps timeline */}
                <div className="space-y-1">
                  {seq.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/50 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-xs text-white/50">
                        {step.delayDays === 0 && step.delayHours === 0
                          ? "Immediate"
                          : `Day ${step.delayDays}${step.delayHours > 0 ? ` +${step.delayHours}h` : ""}`}
                      </span>
                      <span className="text-xs text-white/30">
                        {step.isAiGenerated ? "AI" : "Template"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Enrollment stats */}
                {totalEnrolled > 0 && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    {Object.entries(stats).map(([status, count]) => (
                      <span key={status} className={statusColors[status] || "text-white/40"}>
                        {count} {status}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => onToggle(seq.id, !seq.isActive)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      seq.isActive
                        ? "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
                        : "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                    }`}
                  >
                    {seq.isActive ? "Pause" : "Activate"}
                  </button>
                  <button
                    onClick={() => onEnroll(seq.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
                  >
                    Enroll Lead
                  </button>
                  <button
                    onClick={() => onDelete(seq.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-300/60 hover:bg-red-500/20 hover:text-red-300 transition-colors ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
