"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/budget/format";

type Goal = {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate: string | Date | null;
};

export function GoalsClient({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !target) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vater/budget/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target: Number(target),
          targetDate: targetDate || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setGoals((prev) => [j.goal, ...prev]);
      setName("");
      setTarget("");
      setTargetDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function contribute(id: string, amount: number) {
    try {
      const res = await fetch(`/api/vater/budget/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contribute: amount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setGoals((prev) => prev.map((g) => (g.id === id ? j.goal : g)));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this goal?")) return;
    try {
      const res = await fetch(`/api/vater/budget/goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="vater-card space-y-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">New goal</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="PA move fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            required
          />
          <input
            type="number"
            step="1"
            min="1"
            placeholder="Target $"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            required
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          />
        </div>
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add goal"}
        </button>
      </form>

      {goals.length === 0 ? (
        <div className="vater-card p-6 text-center text-sm text-slate-400">No goals yet.</div>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => {
            const pct = g.targetCents > 0 ? Math.min(100, (g.currentCents / g.targetCents) * 100) : 0;
            const dateLabel = g.targetDate ? new Date(g.targetDate).toLocaleDateString() : null;
            return (
              <div key={g.id} className="vater-card space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-slate-100">{g.name}</div>
                    <div className="text-xs text-slate-400">
                      {formatMoney(g.currentCents)} of {formatMoney(g.targetCents)}
                      {dateLabel ? ` · by ${dateLabel}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(g.id)}
                    className="text-xs text-slate-500 transition hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[10, 50, 100, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => contribute(g.id, amt)}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-500 hover:text-emerald-300"
                    >
                      +${amt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
