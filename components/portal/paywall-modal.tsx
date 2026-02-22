"use client";

type PaywallModalProps = {
  visible: boolean;
  loadingPlan: "basic" | "pro" | null;
  errorMessage: string | null;
  onClose: () => void;
  onStartPlan: (plan: "basic" | "pro") => void;
};

export function PaywallModal({
  visible,
  loadingPlan,
  errorMessage,
  onClose,
  onStartPlan,
}: PaywallModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.2),rgba(141,82,230,0.12)),rgba(10,8,18,0.72)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.66)] backdrop-blur-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white/95">Activate Subscription</h2>
            <p className="mt-1 text-sm leading-6 text-white/75">
              Choose a plan to unlock full T-Agent search access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/18 bg-white/[0.03] px-2 py-1 text-xs tracking-[0.08em] text-white/70 uppercase"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onStartPlan("basic")}
            disabled={Boolean(loadingPlan)}
            className="rounded-2xl border border-white/18 bg-black/25 px-4 py-4 text-left transition hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <p className="text-xs tracking-[0.12em] text-white/66 uppercase">Basic</p>
            <p className="mt-1 text-lg font-semibold text-white/92">30 asks / day</p>
            <p className="mt-1 text-sm text-white/74">Great for daily production flow.</p>
            <p className="mt-3 text-xs font-semibold tracking-[0.12em] text-violet-100 uppercase">
              {loadingPlan === "basic" ? "Starting..." : "Start Basic"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onStartPlan("pro")}
            disabled={Boolean(loadingPlan)}
            className="rounded-2xl border border-violet-200/35 bg-violet-300/10 px-4 py-4 text-left transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <p className="text-xs tracking-[0.12em] text-violet-100/75 uppercase">Pro</p>
            <p className="mt-1 text-lg font-semibold text-white/95">300 asks / day</p>
            <p className="mt-1 text-sm text-white/76">Higher throughput and priority usage.</p>
            <p className="mt-3 text-xs font-semibold tracking-[0.12em] text-violet-100 uppercase">
              {loadingPlan === "pro" ? "Starting..." : "Start Pro"}
            </p>
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-4 text-sm text-rose-200/90">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
