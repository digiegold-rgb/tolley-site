"use client";

import { useCallback, useEffect, useState } from "react";
import { AddExpenseModal } from "./AddExpenseModal";
import { BudgetHero } from "./BudgetHero";
import { CategoryCard } from "./CategoryCard";
import { NetWorthCard } from "./NetWorthCard";
import { RecentEntriesList } from "./RecentEntriesList";
import { SiriSetupCard } from "./SiriSetupCard";
import type { CategoryOption, CategoryState, EntryWithCategory, Hero } from "./types";

export function BudgetDashboardClient({
  initialHero,
  initialCategories,
  initialRecent,
  categoryOptions,
  voiceKeyConfigured,
}: {
  initialHero: Hero;
  initialCategories: CategoryState[];
  initialRecent: EntryWithCategory[];
  categoryOptions: CategoryOption[];
  voiceKeyConfigured: boolean;
}) {
  const [hero, setHero] = useState(initialHero);
  const [categories, setCategories] = useState(initialCategories);
  const [recent, setRecent] = useState<EntryWithCategory[]>(
    initialRecent.map((e) => ({ ...e, occurredAt: new Date(e.occurredAt).toISOString() })),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/vater/budget/state", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setHero(j.hero);
      setCategories(j.categories);
      setRecent(j.recent);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap gap-2 text-xs">
        {[
          ["Transactions", "/vater/budget/transactions"],
          ["Trends", "/vater/budget/trends"],
          ["Goals", "/vater/budget/goals"],
          ["Recurring", "/vater/budget/recurring"],
          ["Accounts", "/vater/budget/accounts"],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 transition hover:border-sky-500 hover:text-sky-300"
          >
            {label}
          </a>
        ))}
      </nav>

      <BudgetHero hero={hero} onAdd={() => setModalOpen(true)} />

      {categories.length === 0 ? (
        <div className="vater-card p-6 text-center text-sm text-slate-400">
          No categories yet. Run{" "}
          <code className="rounded bg-black/40 px-1">npx tsx scripts/budget-seed-categories.ts</code>{" "}
          to seed defaults, or POST to{" "}
          <code className="rounded bg-black/40 px-1">/api/vater/budget/categories</code>.
        </div>
      ) : (
        <section>
          <h2 className="vater-section-title mb-4 text-lg font-semibold text-slate-100">Categories</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="vater-section-title text-lg font-semibold text-slate-100">Recent</h2>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="text-xs text-slate-400 transition hover:text-sky-300 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <RecentEntriesList
            entries={recent}
            onDeleted={(id) => {
              setRecent((prev) => prev.filter((e) => e.id !== id));
              refresh();
            }}
          />
        </section>

        <div className="space-y-6">
          <NetWorthCard />
          <SiriSetupCard keyConfigured={voiceKeyConfigured} />
        </div>
      </div>

      <AddExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categoryOptions}
        onCreated={(entry) => {
          setRecent((prev) => [
            { ...entry, occurredAt: new Date(entry.occurredAt).toISOString() },
            ...prev,
          ]);
          refresh();
        }}
      />
    </div>
  );
}
