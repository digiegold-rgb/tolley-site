"use client";

type Event = {
  type: "statement_close" | "payment_due";
  card: string;
  date: string;
  payBefore?: string;
  currentBalance?: number;
  limit?: number;
  utilization_pct?: number;
  minimumPayment?: number;
  isOverdue?: boolean;
};

export function PaymentCalendar({ events }: { events?: Event[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur-xl">
        <p className="text-[0.68rem] font-medium tracking-[0.35em] text-white/50 uppercase">
          Upcoming Dates
        </p>
        <p className="mt-4 text-sm text-white/30">
          No upcoming events. Add card data to see statement closes and due
          dates.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <p className="text-[0.68rem] font-medium tracking-[0.35em] text-white/50 uppercase">
        Upcoming Dates
      </p>
      <div className="mt-4 space-y-2.5">
        {events.map((e, i) => {
          const isPast = e.date < today;
          const isSoon =
            !isPast &&
            new Date(e.date).getTime() - Date.now() < 7 * 86400000;

          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                e.isOverdue
                  ? "border border-red-400/30 bg-red-400/10"
                  : isSoon
                    ? "border border-yellow-400/20 bg-yellow-400/5"
                    : "bg-white/3"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  e.type === "statement_close"
                    ? "bg-blue-400"
                    : "bg-orange-400"
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/80">
                    {e.card}
                  </span>
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[0.6rem] text-white/40">
                    {e.type === "statement_close" ? "Stmt Close" : "Due"}
                  </span>
                </div>
                {e.type === "statement_close" && e.payBefore && (
                  <p className="text-xs text-yellow-400/70">
                    Pay before {e.payBefore} to lower reported balance
                  </p>
                )}
                {e.type === "payment_due" && e.minimumPayment && (
                  <p className="text-xs text-white/40">
                    Min: ${e.minimumPayment}
                  </p>
                )}
              </div>
              <span
                className={`text-sm font-mono ${isPast ? "text-white/30" : isSoon ? "text-yellow-400" : "text-white/60"}`}
              >
                {e.date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
