"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";

import { TOS_VERSION } from "@/lib/legal-animate";
import { twqSignup } from "@/components/analytics/x-pixel";

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

type SignupFormProps = {
  /** When set, this signup is claiming a Launchpad storefront: shows a required
   *  Terms checkbox and routes to /sales/portal?claim=<slug> so the portal links
   *  the operator + records termsAcceptedAt. */
  claimSlug?: string;
};

export function SignupForm({ claimSlug }: SignupFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => resolveCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );
  const destination = claimSlug
    ? `/sales/portal?claim=${encodeURIComponent(claimSlug)}`
    : callbackUrl;
  /* Jelly Studio signups click through the studio legal set (Terms + Privacy +
   * Beta Addendum) and we stamp the version they accepted onto the User row. */
  const isStudio = !claimSlug && callbackUrl.startsWith("/animate");
  const requiresAgreement = Boolean(claimSlug) || isStudio;

  /* Invite-only beta: the link Jared sends is
   * /signup?callbackUrl=%2Fanimate&invite=CODE, so the field arrives
   * prefilled and the tester never types it. The field is still shown (and
   * editable) because people forward the code without the link. */
  const inviteFromLink = searchParams.get("invite") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invite, setInvite] = useState(inviteFromLink);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password || !confirmPassword) {
      setStatus("error");
      setErrorMessage("Enter email, password, and confirm password.");
      return;
    }

    if (isStudio && !invite.trim()) {
      setStatus("error");
      setErrorMessage(
        "Jelly Studio is invite-only right now. Paste your invite code, or use the link from your invite email.",
      );
      return;
    }

    if (requiresAgreement && !agreed) {
      setStatus("error");
      setErrorMessage(
        claimSlug
          ? "Please agree to the operator terms to claim your storefront."
          : "Please agree to the Terms, Privacy Policy and Beta Addendum to continue.",
      );
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
          callbackUrl,
          ...(isStudio ? { termsVersion: TOS_VERSION } : {}),
          ...(invite.trim() ? { invite: invite.trim() } : {}),
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

    // Account exists at this point — count the Jelly Studio signup for X Ads
    // conversion tracking even if the auto-login below happens to fail.
    if (isStudio) twqSignup();

    const loginResult = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      callbackUrl: destination,
      redirect: false,
    });

    if (loginResult?.error) {
      setStatus("error");
      setErrorMessage("Account created. Please sign in.");
      return;
    }

    router.push(loginResult?.url || destination);
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

      {isStudio ? (
        <>
          <label
            htmlFor="signup-invite"
            className="block text-[0.7rem] tracking-[0.16em] text-white/65 uppercase"
          >
            Invite Code
          </label>
          <input
            id="signup-invite"
            type="text"
            value={invite}
            onChange={(event) => setInvite(event.target.value)}
            placeholder="JELLY-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="signup-invite-note"
            data-testid="signup-invite"
            className="w-full rounded-xl border border-white/18 bg-black/25 px-3 py-2 font-mono text-sm tracking-[0.12em] text-white/90 uppercase outline-none transition focus:border-violet-300/75"
          />
          <p id="signup-invite-note" className="text-[0.7rem] text-white/50">
            {inviteFromLink
              ? "Filled in from your invite link — you shouldn't need to change it."
              : "Jelly Studio is invite-only during the beta. Your code is in your invite email."}
          </p>
        </>
      ) : null}

      {claimSlug ? (
        <label className="flex items-start gap-2 pt-1 text-xs text-white/75">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/sales/terms"
              target="_blank"
              className="text-violet-200 underline underline-offset-2 transition hover:text-white"
            >
              Launchpad operator terms
            </Link>{" "}
            — the cut, the buyout, who owns what, and the kill-switch.
          </span>
        </label>
      ) : null}

      {isStudio ? (
        <label className="flex items-start gap-2 pt-1 text-xs text-white/75">
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            aria-describedby="studio-terms-note"
            className="mt-0.5"
          />
          <span>
            I agree to the Jelly Studio{" "}
            <Link
              href="/animate/terms"
              target="_blank"
              className="text-violet-200 underline underline-offset-2 transition hover:text-white"
            >
              Terms
            </Link>
            ,{" "}
            <Link
              href="/animate/privacy"
              target="_blank"
              className="text-violet-200 underline underline-offset-2 transition hover:text-white"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/animate/beta"
              target="_blank"
              className="text-violet-200 underline underline-offset-2 transition hover:text-white"
            >
              Beta Addendum
            </Link>
            .
            <span id="studio-terms-note" className="mt-1 block text-white/55">
              Beta software, prepaid credits, you own your videos — and you confirm you
              have the right to any voice you clone.
            </span>
          </span>
        </label>
      ) : null}

      {errorMessage ? <p className="text-xs text-rose-200/90">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 w-full rounded-full border border-white/22 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/92 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Creating..." : "Create Account"}
      </button>

      {/* "Already have an account? Sign in" is rendered once by AuthShell (audit AN-12). */}
    </form>
  );
}
