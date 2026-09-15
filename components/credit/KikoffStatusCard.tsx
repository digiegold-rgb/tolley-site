"use client";

import type { KikoffStatus } from "@/lib/credit/types";

const bureauLabel: Record<string, string> = {
  equifax: "Equifax",
  experian: "Experian",
  transunion: "TransUnion",
};

export function KikoffStatusCard({
  status,
}: {
  status?: KikoffStatus | null;
}) {
  const s = status ?? null;
  const reports = s?.reportsTo?.length
    ? s.reportsTo.map((b) => bureauLabel[b] || b).join(", ")
    : "--";

  return (
    <div className="rounded-2xl border border-purple-400/20 bg-[#0d1117] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300">
          Kikoff membership
        </h3>
        <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[0.65rem] font-medium text-purple-300">
          {s?.membershipStatus ?? "unknown"}
        </span>
      </div>
      <p className="mb-3 text-[0.65rem] text-white/35">
        Complements the Kikoff score card — membership and filed disputes only.
        Score stays null until a verified pull.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            Plan
          </p>
          <p className="mt-0.5 text-sm text-white/80">{s?.plan ?? "--"}</p>
        </div>
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            Monthly fee
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            {s?.monthlyFeeUsd != null ? `$${s.monthlyFeeUsd}` : "--"}
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            Tradeline limit
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            {s?.tradelineLimitReported ?? "--"}
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            On-time payment
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            {s?.lastPaymentOnTime == null
              ? "--"
              : s.lastPaymentOnTime
                ? "yes"
                : "no"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[0.65rem] text-white/40">Reports to {reports}</p>
      {s?.openDisputesFiledAt && (
        <p className="mt-1 text-[0.65rem] text-white/40">
          Open disputes filed {s.openDisputesFiledAt}
        </p>
      )}
      {s?.disputedAccounts && s.disputedAccounts.length > 0 && (
        <ul className="mt-2 space-y-1">
          {s.disputedAccounts.map((a, i) => (
            <li key={`${a.creditor}-${a.accountLast4}-${i}`} className="text-xs text-white/50">
              {a.creditor}
              {a.accountLast4 ? ` ····${a.accountLast4}` : ""} — {a.status}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.6rem] text-white/25">
        {s?.lastSyncAt
          ? `synced ${new Date(s.lastSyncAt).toLocaleString("en-US", {
              timeZone: "America/Chicago",
            })} CT`
          : "not synced"}
      </p>
    </div>
  );
}
