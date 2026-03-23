"use client";

type Goal = {
  id: string;
  title: string;
  description: string;
  targetScore: number;
  startScore: number;
  currentScore: number | null;
  startDate: string;
  targetDate: string;
  progressPct: number;
  milestones: { score: number; label: string; reached: boolean }[];
  actions: string[];
};

export function GoalsTimeline({ goals }: { goals?: Goal[] }) {
  if (!goals || goals.length === 0) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/5 p-8 text-center backdrop-blur-xl">
        <p className="text-lg text-white/40">No goals set</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {goals.map((goal) => (
        <div
          key={goal.id}
          className="rounded-2xl border border-white/12 bg-white/5 p-6 backdrop-blur-xl"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white/90">
                {goal.title}
              </h3>
              <p className="mt-1 text-sm text-white/50">{goal.description}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-400">
                {goal.progressPct}%
              </p>
              <p className="text-xs text-white/40">
                Target: {goal.targetDate}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/40">
              <span>Start: {goal.startScore}</span>
              <span>
                Current: {goal.currentScore ?? "?"} / Target:{" "}
                {goal.targetScore}
              </span>
            </div>
            <div className="mt-1.5 h-4 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, goal.progressPct))}%` }}
              />
            </div>
          </div>

          {/* Milestones */}
          <div className="mt-5">
            <p className="mb-2 text-[0.68rem] font-medium tracking-wider text-white/45 uppercase">
              Milestones
            </p>
            <div className="space-y-2">
              {goal.milestones.map((m) => (
                <div key={m.score} className="flex items-center gap-3">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      m.reached
                        ? "bg-green-400/20 text-green-400"
                        : "bg-white/10 text-white/30"
                    }`}
                  >
                    {m.reached ? "\u2713" : m.score}
                  </div>
                  <span
                    className={`text-sm ${m.reached ? "text-green-400/80 line-through" : "text-white/60"}`}
                  >
                    {m.score} — {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5">
            <p className="mb-2 text-[0.68rem] font-medium tracking-wider text-white/45 uppercase">
              Action Items
            </p>
            <ul className="space-y-1.5">
              {goal.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                  <span className="mt-0.5 text-purple-400">&#8250;</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
