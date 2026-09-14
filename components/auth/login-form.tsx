"use client";


import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { signIn } from "next-auth/react";

function resolveCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) {
    return "/leads/dashboard";
  }
  return value;
}

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function LoginForm() {
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => resolveCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setStatus("error");
      setErrorMessage("Enter your email and password.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl,
        redirect: false,
      });

      if (!result || result.error || !result.ok) {
        setStatus("error");
        setErrorMessage("Sign-in failed. Check your email and password, then try again.");
        return;
      }

      // Re-read the new session on the server, including its MFA requirement,
      // instead of reusing a route prefetched while the user was signed out.
      window.location.assign(callbackUrl);
    } catch {
      setStatus("error");
      setErrorMessage("Could not connect to sign in. Please try again.");
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label className="block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase">
        Email
      </label>
      <input
        type="email"
        disabled={!ready}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@agency.com"
        autoComplete="email"
        className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75"
      />

      <label className="block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase">
        Password
      </label>
      <input
        type="password"
        disabled={!ready}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
        className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75"
      />

      <p className="pt-1 text-right">
        <Link
          href={`/reset-password?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          data-testid="forgot-password"
          className="text-xs text-white/60 underline underline-offset-2 transition hover:text-violet-200"
        >
          Forgot password?
        </Link>
      </p>

      {errorMessage ? <p className="text-xs text-rose-200/90">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={!ready || status === "loading"}
        className="mt-2 w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {!ready ? "Loading sign-in…" : status === "loading" ? "Signing In..." : "Sign In"}
      </button>

    </form>
  );
}
