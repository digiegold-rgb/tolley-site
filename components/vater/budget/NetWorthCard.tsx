"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/budget/format";

type NetWorth = {
  ok: boolean;
  liabilitiesCents?: number;
  creditLimitCents?: number;
  utilizationPct?: number | null;
};

export function NetWorthCard() {
  const [data, setData] = useState<NetWorth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vater/budget/networth", { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) {
          setError(j.error || "Net worth unavailable");
          return;
        }
        setData(j);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="vater-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Liabilities
      </h2>
      {error ? (
        <div className="text-xs text-slate-500">{error}</div>
      ) : !data ? (
        <div className="h-12 animate-pulse rounded bg-slate-800/40" />
      ) : (
        <>
          <div className="text-2xl font-bold text-slate-100">
            {formatMoney(data.liabilitiesCents ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            of {formatMoney(data.creditLimitCents ?? 0)} credit
            {data.utilizationPct != null
              ? ` · ${data.utilizationPct.toFixed(1)}% utilization`
              : ""}
          </div>
        </>
      )}
    </section>
  );
}
