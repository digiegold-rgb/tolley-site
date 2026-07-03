"use client";

import { useState, useEffect } from "react";

interface TodayData {
  contactsMade: number;
  goal: number;
  smsSent: number;
  smsReplies: number;
}

export default function ActivityTracker() {
  const [today, setToday] = useState<TodayData | null>(null);

  useEffect(() => {
    fetch("/api/leads/analytics")
      .then((r) => r.json())
      .then((data) => setToday(data.today))
      .catch(() => {});
  }, []);

  if (!today) return null;

  const progress = today.goal > 0 ? Math.min((today.contactsMade / today.goal) * 100, 100) : 0;
  const isComplete = today.contactsMade >= today.goal;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-lg shadow-teal-500/5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Today&apos;s progress</span>
          {isComplete && (
            <span className="rounded-full border border-emerald-400/40 bg-gradient-to-br from-emerald-400/25 to-teal-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 shadow-sm shadow-emerald-500/20">
              Goal met!
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-white/60">
          <span><span className="text-sky-300">{today.smsSent}</span> SMS sent</span>
          <span><span className="text-violet-300">{today.smsReplies}</span> replies</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-white/10 overflow-hidden shadow-inner">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            isComplete
              ? "bg-gradient-to-r from-emerald-400 to-teal-400 shadow-lg shadow-emerald-500/40"
              : "bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 shadow-lg shadow-violet-500/40"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs text-white/60">
        <span><span className="text-white">{today.contactsMade}</span> contacts made</span>
        <span>Goal: {today.goal}</span>
      </div>
    </div>
  );
}
