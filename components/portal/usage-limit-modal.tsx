"use client";

type UsageLimitModalProps = {
  visible: boolean;
  plan: string | null;
  resetAt: string | null;
  onClose: () => void;
  onUpgrade: () => void;
};

function getResetCountdown(resetAt: string | null) {
  if (!resetAt) {
    return "Resets soon";
  }

  const msRemaining = new Date(resetAt).getTime() - Date.now();
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) {
    return "Resets soon";
  }

  const totalMinutes = Math.floor(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `Resets in ${hours}h ${minutes}m`;
  }

  return `Resets in ${minutes}m`;
}

export function UsageLimitModal({
  visible,
  plan,
  resetAt,
  onClose,
  onUpgrade,
}: UsageLimitModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.2),rgba(141,82,230,0.12)),rgba(10,8,18,0.72)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.66)] backdrop-blur-2xl">
        <h2 className="text-lg font-semibold text-white/95">Usage Reached</h2>
        <p className="mt-2 text-sm leading-6 text-white/78">
          You have reached your daily {plan || "current"} plan limit.
        </p>
        <p className="mt-2 text-xs tracking-[0.1em] text-violet-100/80 uppercase">
          {getResetCountdown(resetAt)}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-full border border-violet-200/35 bg-violet-300/12 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-violet-100 uppercase"
          >
            Upgrade Plan
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/22 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/88 uppercase"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
