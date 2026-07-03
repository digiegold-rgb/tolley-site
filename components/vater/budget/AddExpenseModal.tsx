"use client";

import { useEffect, useState } from "react";
import type { CategoryOption, EntryWithCategory } from "./types";

export function AddExpenseModal({
  open,
  onClose,
  categories,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  onCreated: (entry: EntryWithCategory) => void;
}) {
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [tagsInput, setTagsInput] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setVendor("");
      setCategoryId(categories[0]?.id ?? "");
      setTagsInput("");
      setNote("");
      setDate(new Date().toISOString().slice(0, 10));
      setError(null);
    }
  }, [open, categories]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(/[\s,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch("/api/vater/budget/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          vendor: vendor || undefined,
          categoryId: categoryId || undefined,
          tags,
          note: note || undefined,
          occurredAt: new Date(`${date}T12:00:00`).toISOString(),
          source: "MANUAL",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      onCreated(j.entry);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="vater-card w-full max-w-lg space-y-4 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Add expense</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 transition hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
            Amount
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 focus:border-sky-500 focus:outline-none"
              placeholder="45.00"
            />
          </label>

          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-400">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1 text-xs uppercase tracking-wide text-slate-400">
          Vendor
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 focus:border-sky-500 focus:outline-none"
            placeholder="UDF"
          />
        </label>

        <label className="block space-y-1 text-xs uppercase tracking-wide text-slate-400">
          Category
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            <option value="">— Uncategorized —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs uppercase tracking-wide text-slate-400">
          Tags <span className="text-slate-500">(comma-separated, e.g. jeep, family)</span>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 focus:border-sky-500 focus:outline-none"
            placeholder="jeep"
          />
        </label>

        <label className="block space-y-1 text-xs uppercase tracking-wide text-slate-400">
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 focus:border-sky-500 focus:outline-none"
            placeholder="Optional"
          />
        </label>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !amount}
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add expense"}
          </button>
        </div>
      </form>
    </div>
  );
}
