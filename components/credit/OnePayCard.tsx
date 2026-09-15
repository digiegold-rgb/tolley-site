"use client";

import type { OnePaySnapshot } from "@/lib/credit/types";

const usd = (n: number | null | undefined) =>
  n == null ? "--" : `$${Math.round(n).toLocaleString()}`;

const statusStyle: Record<string, string> = {
  current: "bg-green-500/15 text-green-400",
  late: "bg-red-500/15 text-red-400",
  paid_off: "bg-cyan-500/15 text-cyan-400",
  unknown: "bg-white/10 text-white/50",
};

export function OnePayCard({ snapshot }: { snapshot?: OnePaySnapshot | null }) {
  const s = snapshot ?? null;
  const status = s?.status ?? "unknown";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
          OnePay
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${statusStyle[status] || statusStyle.unknown}`}
        >
          {status.replace("_", " ")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            Next due
          </p>
          <p className="mt-0.5 text-sm text-white/80">{s?.nextDueDate ?? "--"}</p>
        </div>
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            Next amount
          </p>
          <p className="mt-0.5 text-sm text-white/80">{usd(s?.nextAmount)}</p>
        </div>
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            Remaining
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            {usd(s?.remainingBalance)}
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] tracking-wider text-white/35 uppercase">
            Installments left
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            {s?.installmentCountRemaining ?? "--"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[0.65rem] text-white/30">
        {s?.accountLast4 ? `····${s.accountLast4}` : "····--"}
        {s?.lastSyncAt
          ? ` · synced ${new Date(s.lastSyncAt).toLocaleString("en-US", {
              timeZone: "America/Chicago",
            })} CT`
          : " · not synced"}
      </p>
      {s?.notes && (
        <p className="mt-1 text-[0.65rem] italic text-white/30">{s.notes}</p>
      )}
    </div>
  );
}
