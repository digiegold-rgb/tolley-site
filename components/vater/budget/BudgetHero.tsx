"use client";

import { formatMoney } from "@/lib/budget/format";
import type { Hero } from "./types";

export function BudgetHero({ hero, onAdd }: { hero: Hero; onAdd: () => void }) {
  const over = hero.totalRemainingCents < 0;
  const pct = Math.min(100, Math.max(0, hero.pctUsed));

  return (
    <section className="vater-card relative overflow-hidden p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-sky-400/80">{hero.monthName}</div>
          <h1 className="vater-neon mt-2 text-4xl font-bold text-slate-100 sm:text-5xl">
            {formatMoney(hero.totalSpentCents)}
          </h1>
          <div className="mt-1 text-sm text-slate-400">
            of {formatMoney(hero.totalLimitCents)} budget ·{" "}
            <span className={over ? "text-red-400" : "text-emerald-400"}>
              {over
                ? `${formatMoney(Math.abs(hero.totalRemainingCents))} over`
                : `${formatMoney(hero.totalRemainingCents)} left`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="vater-cta self-start rounded-md bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 sm:self-auto"
        >
          + Add expense
        </button>
      </div>

      <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-slate-800/80">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? "#ef4444" : "#38bdf8",
            boxShadow: `0 0 12px ${over ? "#ef4444" : "#38bdf8"}66`,
          }}
        />
      </div>
    </section>
  );
}
