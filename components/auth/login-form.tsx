"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";

function resolveCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/leads/dashboard";
  }
  return value;
}

export function LoginForm() {
  const router = useRouter();
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

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      callbackUrl,
      redirect: false,
    });

    if (result?.error) {
      setStatus("error");
      setErrorMessage("Invalid email or password.");
      return;
    }

    router.push(result?.url || callbackUrl);
    router.refresh();
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label className="block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase">
        Email
      </label>
      <input
        type="email"
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
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
        className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75"
      />

      {errorMessage ? <p className="text-xs text-rose-200/90">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Signing In..." : "Sign In"}
      </button>

      <p className="pt-1 text-center text-xs text-white/60">
        Need an account?{" "}
        <Link
          href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="text-violet-200 transition hover:text-white"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
