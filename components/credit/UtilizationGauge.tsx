"use client";

type Props = {
  overall?: {
    balance: number;
    limit: number;
    utilization_pct: number;
    band: string;
  };
  perCard?: {
    account_id: string;
    nickname: string;
    balance: number;
    limit: number;
    utilization_pct: number;
    band: string;
  }[];
};

function getBandColor(band: string) {
  switch (band) {
    case "excellent":
      return "bg-green-400";
    case "good":
      return "bg-emerald-400";
    case "fair":
      return "bg-yellow-400";
    case "poor":
      return "bg-red-400";
    default:
      return "bg-white/20";
  }
}

function getBandTextColor(band: string) {
  switch (band) {
    case "excellent":
      return "text-green-400";
    case "good":
      return "text-emerald-400";
    case "fair":
      return "text-yellow-400";
    case "poor":
      return "text-red-400";
    default:
      return "text-white/40";
  }
}

export function UtilizationGauge({ overall, perCard }: Props) {
  const pct = overall?.utilization_pct ?? 0;
  const band = overall?.band ?? "unknown";

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <p className="text-[0.68rem] font-medium tracking-[0.35em] text-white/50 uppercase">
        Credit Utilization
      </p>

      {/* Overall gauge */}
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <span className={`text-3xl font-bold ${getBandTextColor(band)}`}>
            {pct > 0 ? `${pct}%` : "--"}
          </span>
          <span className="text-sm text-white/50">
            ${(overall?.balance ?? 0).toLocaleString()} / $
            {(overall?.limit ?? 0).toLocaleString()}
          </span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBandColor(band)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[0.6rem] text-white/30">
          <span>0%</span>
          <span className="text-green-400/50">10%</span>
          <span className="text-yellow-400/50">30%</span>
          <span className="text-red-400/50">50%+</span>
        </div>
      </div>

      {/* Per-card breakdown */}
      {perCard && perCard.length > 0 && (
        <div className="mt-4 space-y-2">
          {perCard.map((c) => (
            <div key={c.account_id} className="flex items-center gap-3">
              <span className="w-28 truncate text-xs text-white/60">
                {c.nickname}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${getBandColor(c.band)}`}
                  style={{
                    width: `${Math.min(c.utilization_pct ?? 0, 100)}%`,
                  }}
                />
              </div>
              <span
                className={`w-10 text-right text-xs font-medium ${getBandTextColor(c.band)}`}
              >
                {c.utilization_pct != null ? `${c.utilization_pct}%` : "--"}
              </span>
            </div>
          ))}
        </div>
      )}

      {(!perCard || perCard.length === 0) && (
        <p className="mt-4 text-sm text-white/30">
          No card data yet. Sync Plaid Liabilities to populate.
        </p>
      )}
    </div>
  );
}
