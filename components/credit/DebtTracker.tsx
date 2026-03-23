"use client";

import { useState } from "react";

type Debt = {
  id: string;
  creditor: string;
  accountLast4: string;
  balance: number;
  settlementLow: number;
  settlementHigh: number;
  status: string;
  phase: string;
  phone: string | null;
  notes: string | null;
  settled: boolean;
};

const phaseLabels: Record<string, { label: string; color: string }> = {
  now: { label: "NOW", color: "bg-red-500 text-white" },
  month_1: { label: "MONTH 1", color: "bg-orange-500 text-white" },
  month_2_3: { label: "MONTH 2-3", color: "bg-yellow-500 text-black" },
  month_4_5: { label: "MONTH 4-5", color: "bg-blue-400 text-white" },
  done: { label: "DONE", color: "bg-green-500 text-white" },
};

const barColors: Record<string, string> = {
  chase_2362: "bg-[#f59e0b]",
  pnc_9439: "bg-[#ef4444]",
  apple_3063: "bg-[#eab308]",
  pnc_8534: "bg-[#a78bfa]",
  bofa_7331: "bg-[#22c55e]",
  central_8993: "bg-[#06b6d4]",
  amex_5353: "bg-[#10b981]",
  lending_9854: "bg-[#6b7280]",
};

export function DebtTracker({
  debts,
  totals,
}: {
  debts?: Debt[];
  totals?: {
    totalDebt: number;
    settlementEstLow: number;
    settlementEstHigh: number;
    monthlySurplus: number;
    homeEquity: number;
  };
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!debts || debts.length === 0) return null;

  const maxBalance = Math.max(...debts.map((d) => d.balance));
  const activeDebts = debts.filter((d) => !d.settled && d.balance > 0);
  const settledDebts = debts.filter((d) => d.settled || d.balance === 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6">
      <h3 className="mb-1 text-lg font-bold tracking-wide text-[#00d4ff]">
        DEBT BREAKDOWN
      </h3>

      {/* Summary cards */}
      {totals && (
        <div className="mb-5 mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
            <p className="text-xl font-bold text-red-400">
              ${totals.totalDebt.toLocaleString()}
            </p>
            <p className="text-[0.65rem] text-white/50">Total Debt</p>
          </div>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center">
            <p className="text-xl font-bold text-yellow-400">
              ~${Math.round(totals.settlementEstLow / 1000)}K-$
              {Math.round(totals.settlementEstHigh / 1000)}K
            </p>
            <p className="text-[0.65rem] text-white/50">Settlement Est.</p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-center">
            <p className="text-xl font-bold text-green-400">
              ${totals.monthlySurplus.toLocaleString()}/mo
            </p>
            <p className="text-[0.65rem] text-white/50">Monthly Surplus</p>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center">
            <p className="text-xl font-bold text-cyan-400">
              ${Math.round(totals.homeEquity / 1000)}K
            </p>
            <p className="text-[0.65rem] text-white/50">Home Equity</p>
          </div>
        </div>
      )}

      {/* Debt bars */}
      <div className="space-y-2.5">
        {activeDebts.map((d) => {
          const pct = maxBalance > 0 ? (d.balance / maxBalance) * 100 : 0;
          const phase = phaseLabels[d.phase] || phaseLabels.now;
          const expanded = expandedId === d.id;

          return (
            <div key={d.id}>
              <button
                onClick={() => setExpandedId(expanded ? null : d.id)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${barColors[d.id] || "bg-white/20"} text-black`}
                    >
                      {d.creditor} {d.accountLast4}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="h-7 w-full overflow-hidden rounded bg-white/5">
                      <div
                        className={`flex h-full items-center rounded transition-all duration-700 ${barColors[d.id] || "bg-white/20"}`}
                        style={{ width: `${pct}%` }}
                      >
                        <span className="px-2 text-xs font-bold text-black">
                          ${d.balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <span className="text-sm font-semibold text-white/70">
                      ${(d.settlementLow / 1000).toFixed(0)}K-$
                      {(d.settlementHigh / 1000).toFixed(1)}K
                    </span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[0.6rem] font-bold ${phase.color}`}
                  >
                    {phase.label}
                  </span>
                </div>
              </button>
              {expanded && (
                <div className="ml-28 mt-2 rounded-lg border border-white/8 bg-white/3 p-3 text-sm text-white/60">
                  {d.phone && (
                    <p>
                      Phone:{" "}
                      <span className="font-mono text-white/80">{d.phone}</span>
                    </p>
                  )}
                  {d.notes && <p className="mt-1">{d.notes}</p>}
                  <p className="mt-1">
                    Settle for:{" "}
                    <span className="text-green-400">
                      ${d.settlementLow.toLocaleString()} - $
                      {d.settlementHigh.toLocaleString()}
                    </span>{" "}
                    (
                    {Math.round((d.settlementLow / d.balance) * 100)}-
                    {Math.round((d.settlementHigh / d.balance) * 100)}% of
                    balance)
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Settled / completed items */}
      {settledDebts.length > 0 && (
        <div className="mt-4 rounded-xl bg-green-500/10 px-4 py-3">
          {settledDebts.map((d) => (
            <p key={d.id} className="text-sm text-green-400">
              <span className="font-bold">
                {d.creditor} {d.accountLast4}
              </span>{" "}
              {d.status === "paid" ? "-- PAID IN FULL" : `-- ${d.notes}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
