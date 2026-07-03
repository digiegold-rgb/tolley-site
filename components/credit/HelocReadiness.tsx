"use client";

import { useState } from "react";

type Readiness = {
  ready: boolean;
  gatesGreen: number;
  gatesTotal: number;
  fico: {
    current: number | null;
    target: number;
    met: boolean;
    gap: number | null;
    model: string;
  };
  equity: {
    homeValue: number | null;
    mortgageBalance: number | null;
    equity: number | null;
    available80: number | null;
    available85: number | null;
    met: boolean;
  };
  dti: {
    current: number | null;
    target: number;
    met: boolean | null;
    monthlyDebtPayments: number | null;
    documentedAnnualIncome: number | null;
    maxPaymentsAtTarget: number | null;
    incomeNeededForCurrentPayments: number | null;
    scenarios?: {
      now: { payments: number | null; incomeNeeded: number | null };
      afterTruck: {
        payments: number | null;
        incomeNeeded: number | null;
        saves: number | null;
      };
      afterTruckWithHeloc: {
        payments: number | null;
        incomeNeeded: number | null;
        helocPayment: number | null;
        helocDraw: number | null;
        helocRatePct: number | null;
      };
    };
  };
};

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;

function GateShell({
  label,
  state,
  children,
}: {
  label: string;
  state: "green" | "red" | "amber";
  children: React.ReactNode;
}) {
  const ring =
    state === "green"
      ? "border-green-500/40 bg-green-500/5"
      : state === "amber"
        ? "border-yellow-500/40 bg-yellow-500/5"
        : "border-red-500/40 bg-red-500/5";
  const dot =
    state === "green"
      ? "bg-green-400"
      : state === "amber"
        ? "bg-yellow-400"
        : "bg-red-400";
  const tag =
    state === "green" ? "CLEARED" : state === "amber" ? "NEEDS INPUT" : "NOT YET";
  return (
    <div className={`rounded-xl border ${ring} p-4`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-white/70 uppercase">
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span className="text-[0.6rem] font-bold text-white/50">{tag}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

export function HelocReadiness({
  readiness,
  onSaved,
}: {
  readiness?: Readiness | null;
  onSaved?: () => void;
}) {
  const [income, setIncome] = useState("");
  const [saving, setSaving] = useState(false);

  if (!readiness) return null;
  const { fico, equity, dti } = readiness;

  const saveIncome = async () => {
    const val = parseInt(income.replace(/[^0-9]/g, ""), 10);
    if (!val || val < 1000) return;
    setSaving(true);
    try {
      await fetch("/api/credit/heloc-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentedAnnualIncome: val }),
      });
      onSaved?.();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  // FICO progress: start floor 580 → target
  const ficoFloor = 580;
  const ficoPct =
    fico.current != null
      ? Math.max(
          4,
          Math.min(
            100,
            ((fico.current - ficoFloor) / (fico.target - ficoFloor)) * 100,
          ),
        )
      : 0;

  const dtiState: "green" | "red" | "amber" =
    dti.met === true ? "green" : dti.met === false ? "red" : "amber";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-lg font-bold tracking-wide text-[#00d4ff]">
          HELOC READINESS
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            readiness.ready
              ? "bg-green-500/20 text-green-400"
              : "bg-white/10 text-white/60"
          }`}
        >
          {readiness.gatesGreen} / {readiness.gatesTotal} gates clear
        </span>
      </div>
      <p className="mb-4 text-xs text-white/40">
        All three must be green to qualify. Equity is borrowable now — the score
        and DTI are the work.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* FICO gate */}
        <GateShell label="FICO Score" state={fico.met ? "green" : "red"}>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">
              {fico.current ?? "—"}
            </span>
            <span className="mb-1 text-sm text-white/40">/ {fico.target}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${fico.met ? "bg-green-400" : "bg-orange-400"}`}
              style={{ width: `${ficoPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/50">
            {fico.met
              ? "At or above target ✓"
              : `${fico.gap} points to go`}
          </p>
          <p className="mt-0.5 text-[0.65rem] text-white/30">{fico.model}</p>
        </GateShell>

        {/* Equity gate */}
        <GateShell label="Equity" state={equity.met ? "green" : "red"}>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">
              {usd(equity.available85)}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/50">available @ 85% CLTV</p>
          <div className="mt-2 space-y-0.5 text-[0.65rem] text-white/40">
            <p>Value {usd(equity.homeValue)} · Owe {usd(equity.mortgageBalance)}</p>
            <p>
              Equity {usd(equity.equity)} · ~{usd(equity.available80)} @ 80%
            </p>
          </div>
        </GateShell>

        {/* DTI gate */}
        <GateShell label="Debt-to-Income" state={dtiState}>
          {dti.current != null ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-white">
                  {dti.current}%
                </span>
                <span className="mb-1 text-sm text-white/40">
                  / {dti.target}%
                </span>
              </div>
              <p className="mt-2 text-xs text-white/50">
                {dti.met
                  ? "Under the limit ✓"
                  : `Over the ${dti.target}% limit`}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-white/30">
                {usd(dti.monthlyDebtPayments)}/mo on{" "}
                {usd(dti.documentedAnnualIncome)}/yr · max payment{" "}
                {usd(dti.maxPaymentsAtTarget)}/mo
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-white/60">
                Add documented annual income to compute DTI.
              </p>
              <p className="mt-1 text-[0.65rem] text-white/35">
                At {usd(dti.monthlyDebtPayments)}/mo in payments, you need ~
                {usd(dti.incomeNeededForCurrentPayments)}/yr to hit {dti.target}%.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="$ / year"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white placeholder-white/30 focus:border-[#00d4ff]/50 focus:outline-none"
                />
                <button
                  onClick={saveIncome}
                  disabled={saving}
                  className="shrink-0 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/15 px-3 py-1 text-sm font-medium text-white hover:bg-[#00d4ff]/25 disabled:opacity-50"
                >
                  {saving ? "…" : "Save"}
                </button>
              </div>
            </>
          )}
        </GateShell>
      </div>

      {/* DTI path — how the income bar moves as you clear payments */}
      {dti.scenarios && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="mb-1 text-xs font-bold tracking-wider text-[#00d4ff] uppercase">
            Income bar — your path
          </h4>
          <p className="mb-3 text-[0.65rem] text-white/40">
            Provable income needed to keep DTI at/under {dti.target}%. Lower
            payments = lower bar. The HELOC payment itself counts against you.
          </p>
          <div className="space-y-2">
            {[
              {
                label: "Today",
                s: dti.scenarios.now,
                note: "mortgage + truck + card mins",
                accent: "text-white/70",
              },
              {
                label: "Truck paid off",
                s: dti.scenarios.afterTruck,
                note: `frees ${usd(dti.scenarios.afterTruck.saves)}/mo`,
                accent: "text-green-400",
              },
              {
                label: `+ ${usd(dti.scenarios.afterTruckWithHeloc.helocDraw)} HELOC draw`,
                s: dti.scenarios.afterTruckWithHeloc,
                note: `adds ${usd(dti.scenarios.afterTruckWithHeloc.helocPayment)}/mo @ ${dti.scenarios.afterTruckWithHeloc.helocRatePct}% IO`,
                accent: "text-white/70",
              },
            ].map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className={`text-sm font-medium ${row.accent}`}>
                    {row.label}
                  </span>
                  <span className="ml-2 text-[0.65rem] text-white/35">
                    {row.note}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold text-white">
                    {usd(row.s.incomeNeeded)}
                    <span className="text-[0.65rem] font-normal text-white/40">
                      /yr
                    </span>
                  </span>
                  <span className="ml-2 text-[0.65rem] text-white/35">
                    {usd(row.s.payments)}/mo
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.65rem] text-white/40">
            Thin provable income? The smaller the draw, the lower the bar — or
            use a self-employed path: documented S-corp W-2 + 2025 returns, a
            bank-statement HELOC, or (if this is a rental) a DSCR loan that
            qualifies off rent, not your income.
          </p>
        </div>
      )}
    </div>
  );
}
