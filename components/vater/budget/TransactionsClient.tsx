"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/budget/format";
import type { CategoryOption, EntryWithCategory } from "./types";

type Tab = "all" | "needs-review" | "voice" | "plaid";

const SOURCE_COLOR = {
  MANUAL: "bg-slate-500/20 text-slate-300",
  VOICE: "bg-sky-500/20 text-sky-300",
  PLAID: "bg-emerald-500/20 text-emerald-300",
} as const;

export function TransactionsClient({ categories }: { categories: CategoryOption[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [entries, setEntries] = useState<EntryWithCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (tab === "needs-review") params.set("needsReview", "true");
      else if (tab === "voice") params.set("source", "VOICE");
      else if (tab === "plaid") params.set("source", "PLAID");
      if (search) params.set("search", search);
      if (categoryId) params.set("categoryId", categoryId);

      const res = await fetch(`/api/vater/budget/entries?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setEntries(j.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tab, search, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setEntryCategory(entryId: string, newCategoryId: string | null) {
    try {
      const res = await fetch(`/api/vater/budget/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: newCategoryId,
          needsReview: !newCategoryId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === entryId ? j.entry : e)));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function bulkRecategorize() {
    setRecategorizing(true);
    try {
      const res = await fetch("/api/vater/budget/categorize", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      alert(`Updated ${j.updated} entries.${j.errors?.length ? ` ${j.errors.length} errors.` : ""}`);
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setRecategorizing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "needs-review", "voice", "plaid"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              tab === t
                ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
                : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}
          >
            {t === "all" ? "All" : t === "needs-review" ? "Needs review" : t === "voice" ? "Siri" : "Bank"}
          </button>
        ))}
        {tab === "needs-review" && (
          <button
            type="button"
            onClick={bulkRecategorize}
            disabled={recategorizing}
            className="rounded-full border border-amber-500/60 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
          >
            {recategorizing ? "Categorizing…" : "Auto-categorize all"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor / note"
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
        >
          <option value="">All categories</option>
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

      {loading ? (
        <div className="vater-card p-6 text-center text-sm text-slate-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="vater-card p-6 text-center text-sm text-slate-400">No transactions match.</div>
      ) : (
        <div className="vater-card divide-y divide-slate-800">
          {entries.map((e) => {
            const date = new Date(e.occurredAt);
            return (
              <div key={e.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                    <span className="truncate">{e.vendor || e.note || "Untitled"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_COLOR[e.source]}`}>
                      {e.source === "VOICE" ? "Siri" : e.source === "PLAID" ? "Bank" : "Manual"}
                    </span>
                    {e.needsReview && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Review
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{date.toLocaleDateString()}</span>
                    {e.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                    {e.rawText && <span className="truncate text-slate-500">"{e.rawText}"</span>}
                  </div>
                </div>
                <select
                  value={e.category?.id ?? ""}
                  onChange={(ev) => setEntryCategory(e.id, ev.target.value || null)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}{c.name}
                    </option>
                  ))}
                </select>
                <div className={`text-right text-sm font-semibold ${e.amountCents > 0 ? "text-emerald-400" : "text-slate-100"}`}>
                  {formatMoney(e.amountCents, { signed: true })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
