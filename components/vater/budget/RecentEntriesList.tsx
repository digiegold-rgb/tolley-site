"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/budget/format";
import type { EntryWithCategory } from "./types";

const SOURCE_LABEL: Record<EntryWithCategory["source"], string> = {
  MANUAL: "Manual",
  VOICE: "Siri",
  PLAID: "Bank",
};

const SOURCE_COLOR: Record<EntryWithCategory["source"], string> = {
  MANUAL: "bg-slate-500/20 text-slate-300",
  VOICE: "bg-sky-500/20 text-sky-300",
  PLAID: "bg-emerald-500/20 text-emerald-300",
};

export function RecentEntriesList({
  entries,
  onDeleted,
}: {
  entries: EntryWithCategory[];
  onDeleted: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/vater/budget/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted(id);
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    } finally {
      setDeletingId(null);
    }
  }

  if (!entries.length) {
    return (
      <div className="vater-card p-6 text-center text-sm text-slate-400">
        No entries yet. Add one with the button above or via Siri.
      </div>
    );
  }

  return (
    <div className="vater-card divide-y divide-slate-800">
      {entries.map((e) => {
        const date = new Date(e.occurredAt);
        return (
          <div key={e.id} className="flex items-center gap-3 p-4">
            <span
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{ backgroundColor: e.category?.color ?? "#475569" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <span className="truncate">{e.vendor || e.note || "Untitled"}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_COLOR[e.source]}`}>
                  {SOURCE_LABEL[e.source]}
                </span>
                {e.needsReview && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Review
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{e.category?.name ?? "Uncategorized"}</span>
                <span aria-hidden>·</span>
                <span>{date.toLocaleDateString()}</span>
                {e.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className={`text-right text-sm font-semibold ${e.amountCents > 0 ? "text-emerald-400" : "text-slate-100"}`}>
              {formatMoney(e.amountCents, { signed: true })}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(e.id)}
              disabled={deletingId === e.id}
              className="text-xs text-slate-500 transition hover:text-red-400 disabled:opacity-40"
              aria-label="Delete entry"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
