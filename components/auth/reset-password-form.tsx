"use client";

/**
 * ResetPasswordForm — both halves of the password-reset flow in one component,
 * because they are one page (/reset-password) with and without `?token=`.
 *
 *   no token  → "email me a link"  → POST /api/auth/password-reset/request
 *   token     → "choose a new one" → POST /api/auth/password-reset/confirm
 *
 * The request half deliberately shows the SAME confirmation whether or not
 * the address has an account — the API answers 200 either way, and a UI that
 * distinguished them would reintroduce the account-existence oracle the API
 * is careful to avoid.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75";
const LABEL_CLASS =
  "block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase";
const BUTTON_CLASS =
  "mt-2 w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70";

export interface ResetPasswordFormProps {
  /** Present when the user arrived from the emailed link. */
  token?: string;
  /** Where to send them after a successful reset. */
  callbackUrl: string;
}

export function ResetPasswordForm({
  token,
  callbackUrl,
}: ResetPasswordFormProps) {
  return token ? (
    <ConfirmForm token={token} callbackUrl={callbackUrl} />
  ) : (
    <RequestForm />
  );
}

function RequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setStatus("error");
      setMessage("Enter the email address on your account.");
      return;
    }

    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await response.json()) as { message?: string; error?: string };

      if (response.status === 429) {
        setStatus("error");
        setMessage("Too many requests. Wait an hour and try again.");
        return;
      }

      setStatus("sent");
      setMessage(
        data.message ||
          "If an account exists for that email, a reset link is on its way.",
      );
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Check your connection and try again.");
    }
  };

  if (status === "sent") {
    return (
      <div className="space-y-4" data-testid="reset-sent">
        <p className="text-sm leading-relaxed text-white/80">{message}</p>
        <p className="text-xs text-white/55">
          The link works once and expires in one hour. Nothing arrived? Check spam,
          then try again.
        </p>
        <Link
          href="/login"
          className="inline-block text-xs tracking-[0.12em] text-violet-200 uppercase underline underline-offset-4 transition hover:text-white"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label htmlFor="reset-email" className={LABEL_CLASS}>
        Email
      </label>
      <input
        id="reset-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@agency.com"
        autoComplete="email"
        data-testid="reset-email"
        className={INPUT_CLASS}
      />

      {message ? <p className="text-xs text-rose-200/90">{message}</p> : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className={BUTTON_CLASS}
        data-testid="reset-request-submit"
      >
        {status === "loading" ? "Sending..." : "Email me a reset link"}
      </button>

      <p className="pt-1 text-center text-xs text-white/55">
        Remembered it?{" "}
        <Link
          href="/login"
          className="text-violet-200 underline underline-offset-2 transition hover:text-white"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

function ConfirmForm({ token, callbackUrl }: { token: string; callbackUrl: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || data.error) {
        setStatus("error");
        setMessage(data.error || "Couldn't reset your password.");
        return;
      }

      setStatus("done");
      setMessage(data.message || "Password updated.");
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Check your connection and try again.");
    }
  };

  if (status === "done") {
    return (
      <div className="space-y-4" data-testid="reset-done">
        <p className="text-sm leading-relaxed text-white/80">{message}</p>
        <button
          type="button"
          onClick={() =>
            router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
          }
          className={BUTTON_CLASS}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label htmlFor="reset-password" className={LABEL_CLASS}>
        New Password
      </label>
      <input
        id="reset-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="at least 8 characters"
        autoComplete="new-password"
        data-testid="reset-password"
        className={INPUT_CLASS}
      />

      <label htmlFor="reset-password-confirm" className={LABEL_CLASS}>
        Confirm New Password
      </label>
      <input
        id="reset-password-confirm"
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="repeat password"
        autoComplete="new-password"
        data-testid="reset-password-confirm"
        className={INPUT_CLASS}
      />

      {message ? <p className="text-xs text-rose-200/90">{message}</p> : null}

      <p className="text-[0.7rem] leading-relaxed text-white/50">
        Setting a new password signs you out everywhere else.
      </p>

      <button
        type="submit"
        disabled={status === "loading"}
        className={BUTTON_CLASS}
        data-testid="reset-confirm-submit"
      >
        {status === "loading" ? "Updating..." : "Set new password"}
      </button>
    </form>
  );
}
