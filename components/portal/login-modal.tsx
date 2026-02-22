"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

type LoginModalProps = {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
};

export function LoginModal({
  visible,
  title = "Sign In Required",
  message = "Log in with your email link to continue searching.",
  onClose,
}: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setStatus("error");
      setErrorMessage("Enter your email to receive a login link.");
      return;
    }

    try {
      setStatus("sending");
      setErrorMessage(null);

      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/",
      });

      if (result?.error) {
        setStatus("error");
        setErrorMessage("Unable to send login link. Please try again.");
        return;
      }

      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMessage("Unable to send login link. Please try again.");
    }
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

        {status === "sent" ? (
          <p className="rounded-2xl border border-emerald-200/35 bg-emerald-300/10 px-4 py-3 text-sm leading-6 text-emerald-100/90">
            Login link sent. Check your inbox, then return to continue.
          </p>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@agency.com"
              className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75"
            />
            {errorMessage ? (
              <p className="text-xs text-rose-200/90">{errorMessage}</p>
            ) : null}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === "sending" ? "Sending..." : "Send Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
