"use client";

type Debt = {
  id: string;
  creditor: string;
  accountLast4: string;
  balance: number;
  status: string;
  settled: boolean;
  lastActivityDate?: string;
  lastPaymentDate?: string;
  chargeOffDate?: string;
  solType?: string;
};

const MO_SOL_YEARS: Record<string, number> = {
  credit_card: 5,
  open_account: 5,
  written_contract: 10,
  oral_contract: 5,
};

function calculateSOL(debt: Debt) {
  const debtType = debt.solType || "credit_card";
  const solYears = MO_SOL_YEARS[debtType] || 5;
  const lastActivity =
    debt.lastActivityDate || debt.lastPaymentDate || debt.chargeOffDate;

  if (!lastActivity) return { status: "unknown" as const, daysRemaining: 0 };

  const expiry = new Date(lastActivity);
  expiry.setFullYear(expiry.getFullYear() + solYears);
  const days = Math.ceil(
    (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const status: "expired" | "expiring_soon" | "active" | "unknown" =
    days <= 0 ? "expired" : days <= 180 ? "expiring_soon" : "active";

  return {
    status,
    daysRemaining: Math.max(0, days),
    expiryDate: expiry.toISOString().split("T")[0],
    solYears,
    debtType,
    lastActivity,
  };
}

const statusStyles = {
  expired: {
    border: "border-green-500/30",
    bg: "bg-green-500/10",
    text: "text-green-400",
    label: "SOL EXPIRED",
  },
  expiring_soon: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    label: "EXPIRING SOON",
  },
  active: {
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    text: "text-red-400",
    label: "ACTIVE",
  },
  unknown: {
    border: "border-white/10",
    bg: "bg-white/5",
    text: "text-white/40",
    label: "NO DATE",
  },
};

export function SOLCalculator({ debts }: { debts?: Debt[] }) {
  if (!debts) return null;

  const activeDebts = debts.filter((d) => !d.settled && d.balance > 0);
  if (activeDebts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
        Missouri Statute of Limitations
      </h3>
      <p className="mb-4 text-xs text-white/40">
        MO: 5 years credit cards, 10 years written contracts
      </p>

      {/* Warning */}
      <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
        <p className="text-xs font-bold text-red-400">
          DO NOT make any payment on a time-barred debt — it restarts the SOL
          clock!
        </p>
      </div>

      <div className="space-y-2">
        {activeDebts.map((debt) => {
          const sol = calculateSOL(debt);
          const style = statusStyles[sol.status];

          return (
            <div
              key={debt.id}
              className={`rounded-xl border ${style.border} ${style.bg} p-3`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {debt.creditor}
                  </span>
                  <span className="text-xs text-white/30">
                    ****{debt.accountLast4}
                  </span>
                  <span className="text-xs text-white/40">
                    ${debt.balance.toLocaleString()}
                  </span>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-bold ${style.border} ${style.text}`}
                >
                  {style.label}
                </span>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-white/40">
                {sol.lastActivity && (
                  <span>Last activity: {sol.lastActivity}</span>
                )}
                {sol.expiryDate && <span>Expires: {sol.expiryDate}</span>}
                {sol.status !== "unknown" && (
                  <span className={style.text}>
                    {sol.status === "expired"
                      ? "Collector CANNOT sue"
                      : `${sol.daysRemaining} days remaining`}
                  </span>
                )}
                {sol.status === "unknown" && (
                  <span>
                    Add lastActivityDate to debt record to calculate
                  </span>
                )}
              </div>
              {sol.status === "expired" && (
                <p className="mt-1 text-xs text-green-400/70">
                  If sued on this debt, raise SOL as affirmative defense. Suing
                  on time-barred debt is itself an FDCPA violation.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
