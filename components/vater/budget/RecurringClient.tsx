"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/budget/format";
import type { CategoryOption } from "./types";

type Recurring = {
  id: string;
  name: string;
  amountCents: number;
  cadence: string;
  dayOfMonth: number | null;
  categoryId: string | null;
  nextDueAt: string | Date;
  active: boolean;
  category: { id: string; name: string; color: string; icon: string | null } | null;
};

const CADENCES = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
] as const;

export function RecurringClient({
  initialRecurring,
  categories,
}: {
  initialRecurring: Recurring[];
  categories: CategoryOption[];
}) {
  const [recurring, setRecurring] = useState(initialRecurring);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<"monthly" | "weekly" | "yearly">("monthly");
  const [categoryId, setCategoryId] = useState("");
  const [nextDueAt, setNextDueAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vater/budget/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: Number(amount),
          cadence,
          categoryId: categoryId || undefined,
          nextDueAt: new Date(`${nextDueAt}T12:00:00`).toISOString(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setRecurring((prev) => [...prev, { ...j.recurring, category: null }]);
      setName("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/vater/budget/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      alert(`Failed: HTTP ${res.status}`);
      return;
    }
    const j = await res.json();
    setRecurring((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: j.recurring.active } : r)),
    );
  }

  async function remove(id: string) {
    if (!confirm("Delete this recurring bill?")) return;
    const res = await fetch(`/api/vater/budget/recurring/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(`Failed: HTTP ${res.status}`);
      return;
    }
    setRecurring((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="vater-card space-y-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">New recurring bill</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Netflix"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            required
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Amount $"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            required
          />
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as typeof cadence)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {CADENCES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={nextDueAt}
            onChange={(e) => setNextDueAt(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none sm:col-span-2"
          >
            <option value="">— Category (optional) —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
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
          {submitting ? "Adding…" : "Add bill"}
        </button>
      </form>

      {recurring.length === 0 ? (
        <div className="vater-card p-6 text-center text-sm text-slate-400">No recurring bills yet.</div>
      ) : (
        <div className="vater-card divide-y divide-slate-800">
          {recurring.map((r) => {
            const due = new Date(r.nextDueAt);
            return (
              <div key={r.id} className={`flex items-center gap-3 p-4 ${r.active ? "" : "opacity-50"}`}>
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: r.category?.color ?? "#475569" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">{r.name}</div>
                  <div className="text-xs text-slate-400">
                    {r.cadence} · next: {due.toLocaleDateString()}
                    {r.category ? ` · ${r.category.name}` : ""}
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-slate-100">
                  {formatMoney(-r.amountCents)}
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(r.id, !r.active)}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-sky-500 hover:text-sky-300"
                >
                  {r.active ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="text-xs text-slate-500 transition hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
