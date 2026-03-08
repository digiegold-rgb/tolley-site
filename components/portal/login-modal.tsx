"use client";

import { useRouter } from "next/navigation";

type LoginModalProps = {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
};

export function LoginModal({
  visible,
  title = "Sign In Required",
  message = "Log in with your account credentials to continue searching.",
  onClose,
}: LoginModalProps) {
  const router = useRouter();

  if (!visible) {
    return null;
  }

  const openAuth = (path: "/login" | "/signup") => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    router.push(`${path}?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.2),rgba(141,82,230,0.12)),rgba(10,8,18,0.7)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.66)] backdrop-blur-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white/95">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-white/75">{message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/18 bg-white/[0.03] px-2 py-1 text-xs tracking-[0.08em] text-white/70 uppercase"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => openAuth("/login")}
            className="w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/92 uppercase transition hover:bg-white/[0.1]"
          >
            Go to Login
          </button>
          <button
            type="button"
            onClick={() => openAuth("/signup")}
            className="w-full rounded-full border border-white/20 bg-black/25 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/86 uppercase transition hover:bg-black/35"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
