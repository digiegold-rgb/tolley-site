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

type RegisterResponse = {
  ok?: boolean;
  error?: string;
};

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => resolveCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password || !confirmPassword) {
      setStatus("error");
      setErrorMessage("Enter email, password, and confirm password.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    let registerData: RegisterResponse | null = null;
    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      registerData = (await registerResponse.json()) as RegisterResponse;
      if (!registerResponse.ok || registerData?.error) {
        setStatus("error");
        setErrorMessage(registerData?.error || "Unable to create account.");
        return;
      }
    } catch {
      setStatus("error");
      setErrorMessage("Unable to create account.");
      return;
    }

    const loginResult = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      callbackUrl,
      redirect: false,
    });

    if (loginResult?.error) {
      setStatus("error");
      setErrorMessage("Account created. Please sign in.");
      return;
    }

    router.push(loginResult?.url || callbackUrl);
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
        className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75"
      />

      <label className="block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase">
        Password
      </label>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="at least 8 characters"
        className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75"
      />

      <label className="block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase">
        Confirm Password
      </label>
      <input
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="repeat password"
        className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 text-sm text-white/90 outline-none transition focus:border-violet-300/75"
      />

      {errorMessage ? <p className="text-xs text-rose-200/90">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Creating..." : "Create Account"}
      </button>

      <p className="pt-1 text-center text-xs text-white/60">
        Already have an account?{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="text-violet-200 transition hover:text-white"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
