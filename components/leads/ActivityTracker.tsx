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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/70">Today&apos;s Progress</span>
          {isComplete && (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-300">
              Goal Met!
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span>{today.smsSent} SMS sent</span>
          <span>{today.smsReplies} replies</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            isComplete ? "bg-green-500" : "bg-purple-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs text-white/40">
        <span>{today.contactsMade} contacts made</span>
        <span>Goal: {today.goal}</span>
      </div>
    </div>
  );
}
