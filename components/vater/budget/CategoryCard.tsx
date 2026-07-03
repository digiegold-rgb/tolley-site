"use client";

import { formatMoney } from "@/lib/budget/format";
import type { CategoryState } from "./types";

export function CategoryCard({ category }: { category: CategoryState }) {
  const over = category.remainingCents < 0;
  const pct = Math.min(100, Math.max(0, category.pctUsed));
  const barColor = over ? "#ef4444" : category.color;

  return (
    <div className="vater-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>{category.icon ?? "📦"}</span>
          <div>
            <div className="text-sm font-semibold text-slate-100">{category.name}</div>
            <div className="text-xs text-slate-400">
              {formatMoney(category.spentCents)} of {formatMoney(category.monthlyLimitCents)}
            </div>
          </div>
        </div>
        <div className={`text-right text-sm font-semibold ${over ? "text-red-400" : "text-sky-400"}`}>
          {over
            ? `${formatMoney(Math.abs(category.remainingCents))} over`
            : `${formatMoney(category.remainingCents)} left`}
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${barColor}66`,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{Math.round(category.pctUsed)}% used</span>
        {category.pctUsed > 100 && <span className="text-red-400">Over budget</span>}
      </div>
    </div>
  );
}
