"use client";

type AccountPopoverProps = {
  visible: boolean;
  email?: string | null;
  onManageBilling: () => void;
  onSignOut: () => void;
};

export function AccountPopover({
  visible,
  email,
  onManageBilling,
  onSignOut,
}: AccountPopoverProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="absolute top-16 right-0 z-40 w-60 rounded-2xl border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(126,75,226,0.1)),rgba(10,8,18,0.75)] p-4 shadow-[0_18px_42px_rgba(2,2,10,0.6)] backdrop-blur-xl">
      <p className="truncate text-xs text-white/70">{email || "Signed in"}</p>
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={onManageBilling}
          className="w-full rounded-full border border-white/22 bg-white/[0.05] px-3 py-2 text-xs font-semibold tracking-[0.1em] text-white/88 uppercase"
        >
          Billing
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full rounded-full border border-white/18 bg-transparent px-3 py-2 text-xs font-semibold tracking-[0.1em] text-white/74 uppercase"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
