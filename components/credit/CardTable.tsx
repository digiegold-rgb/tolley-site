"use client";

import { useState } from "react";

type Card = {
  account_id: string;
  nickname: string;
  name: string;
  balance_current: number;
  balance_limit: number;
  utilization_pct: number | null;
  utilizationBand: string;
  aprs: { apr_percentage: number; apr_type: string }[];
  minimum_payment_amount: number | null;
  next_payment_due_date: string | null;
  statementCloseDay: number | null;
  paymentDueDay: number | null;
  is_overdue: boolean;
  isSecured: boolean;
  isAuthorizedUser: boolean;
  notes: string | null;
};

function getBandBg(band: string) {
  switch (band) {
    case "excellent":
      return "bg-green-400/15 text-green-400";
    case "good":
      return "bg-emerald-400/15 text-emerald-400";
    case "fair":
      return "bg-yellow-400/15 text-yellow-400";
    case "poor":
      return "bg-red-400/15 text-red-400";
    default:
      return "bg-white/10 text-white/40";
  }
}

export function CardTable({
  cards,
  totals,
}: {
  cards?: Card[];
  totals?: any;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [closeDay, setCloseDay] = useState("");

  const saveCloseDay = async (accountId: string) => {
    try {
      await fetch(`/api/credit/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          statementCloseDay: parseInt(closeDay),
        }),
      });
    } catch {}
    setEditingId(null);
    setCloseDay("");
  };

  if (!cards || cards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/5 p-8 text-center backdrop-blur-xl">
        <p className="text-lg text-white/40">No credit cards tracked yet</p>
        <p className="mt-2 text-sm text-white/25">
          Enable Plaid Liabilities to auto-populate your cards, or add scores
          manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Totals bar */}
      {totals && (
        <div className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-[0.6rem] text-white/40 uppercase">
              Total Balance
            </p>
            <p className="text-lg font-bold text-white/90">
              ${totals.total_balance?.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] text-white/40 uppercase">
              Total Limit
            </p>
            <p className="text-lg font-bold text-white/90">
              ${totals.total_limit?.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] text-white/40 uppercase">
              Overall Util
            </p>
            <p className="text-lg font-bold text-white/90">
              {totals.overall_utilization_pct}%
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] text-white/40 uppercase">Min Due</p>
            <p className="text-lg font-bold text-white/90">
              ${totals.total_minimum_payment?.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Card list */}
      <div className="overflow-x-auto rounded-2xl border border-white/12 bg-white/5 backdrop-blur-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[0.65rem] text-white/40 uppercase">
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Limit</th>
              <th className="px-4 py-3">Util %</th>
              <th className="px-4 py-3">APR</th>
              <th className="px-4 py-3">Min Payment</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Stmt Close</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr
                key={c.account_id}
                className="border-b border-white/5 transition hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white/85">
                      {c.nickname}
                    </span>
                    {c.is_overdue && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[0.6rem] text-red-400">
                        OVERDUE
                      </span>
                    )}
                    {c.isSecured && (
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[0.6rem] text-blue-400">
                        Secured
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-white/70">
                  ${c.balance_current?.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-white/50">
                  ${c.balance_limit?.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${getBandBg(c.utilizationBand)}`}
                  >
                    {c.utilization_pct != null ? `${c.utilization_pct}%` : "--"}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/50">
                  {c.aprs?.[0]?.apr_percentage
                    ? `${c.aprs[0].apr_percentage}%`
                    : "--"}
                </td>
                <td className="px-4 py-3 font-mono text-white/50">
                  {c.minimum_payment_amount
                    ? `$${c.minimum_payment_amount}`
                    : "--"}
                </td>
                <td className="px-4 py-3 text-white/50">
                  {c.next_payment_due_date || "--"}
                </td>
                <td className="px-4 py-3">
                  {editingId === c.account_id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={closeDay}
                        onChange={(e) => setCloseDay(e.target.value)}
                        className="w-14 rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white"
                        placeholder="Day"
                      />
                      <button
                        onClick={() => saveCloseDay(c.account_id)}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(c.account_id);
                        setCloseDay(c.statementCloseDay?.toString() || "");
                      }}
                      className="text-white/40 hover:text-white/70"
                    >
                      {c.statementCloseDay
                        ? `Day ${c.statementCloseDay}`
                        : "Set"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
