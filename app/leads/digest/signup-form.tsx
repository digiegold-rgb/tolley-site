"use client";

/**
 * Signup form for the KC Motivated Seller Digest.
 *
 * Step 1 verifies the agent's MO/KS real estate license against the state
 * registry (/api/leads/digest/verify-license) with a staged progress bar;
 * the rest of the form unlocks on a verified or manual-review result.
 * POSTs to /api/leads/digest/subscribe (which re-verifies server-side) and
 * redirects to Stripe Checkout. Every failure path surfaces inline — no
 * silent catches.
 */

import { useEffect, useRef, useState } from "react";

import { DIGEST_COVERAGE_GROUPS } from "@/lib/leads/digest-coverage";

const MAX_ZIPS = 7;

type LicenseResult = {
  status: "verified" | "manual_review" | "invalid";
  licenseeName?: string;
  profession?: string;
  expirationDate?: string;
  reason?: string;
};

const VERIFY_STAGES = [
  "Checking license format…",
  "Querying state registry…",
  "Confirming active status…",
];
/** Minimum ms the progress bar runs so the check reads as a real lookup. */
const VERIFY_MIN_MS = 2400;

export default function DigestSignupForm() {
  const [licenseState, setLicenseState] = useState<"MO" | "KS">("MO");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verifyStage, setVerifyStage] = useState(0);
  const [license, setLicense] = useState<LicenseResult | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zips, setZips] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const licenseOk = license?.status === "verified" || license?.status === "manual_review";

  function resetLicense() {
    setLicense(null);
    setVerifyProgress(0);
    setVerifyStage(0);
  }

  async function handleVerify() {
    setError(null);
    const num = licenseNumber.trim();
    if (num.length < 4) {
      setError("Enter your license number first (at least 4 characters).");
      return;
    }
    setVerifying(true);
    resetLicense();

    // Progress animation: ease toward 90% across the stages; the API result
    // snaps it to 100%. Never completes on its own.
    const startedAt = Date.now();
    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(90, (elapsed / VERIFY_MIN_MS) * 90);
      setVerifyProgress(pct);
      setVerifyStage(pct < 30 ? 0 : pct < 65 ? 1 : 2);
    }, 80);

    let result: LicenseResult;
    try {
      const res = await fetch("/api/leads/digest/verify-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: licenseState, licenseNumber: num }),
      });
      const data = (await res.json()) as LicenseResult & { error?: string };
      if (!res.ok) throw new Error(data.error || `Verification failed (${res.status})`);
      result = data;
    } catch (err) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      setVerifying(false);
      setVerifyProgress(0);
      setError(
        err instanceof Error ? err.message : "Verification failed — please try again."
      );
      return;
    }

    // Let the bar finish its run before revealing the result.
    const remaining = Math.max(0, VERIFY_MIN_MS - (Date.now() - startedAt));
    await new Promise((r) => setTimeout(r, remaining));
    if (progressTimer.current) clearInterval(progressTimer.current);
    setVerifyProgress(100);
    setVerifyStage(2);
    setVerifying(false);
    setLicense(result);
  }

  function toggleZip(zip: string) {
    setError(null);
    setZips((prev) => {
      if (prev.includes(zip)) return prev.filter((z) => z !== zip);
      if (prev.length >= MAX_ZIPS) return prev; // chip is disabled, but belt-and-suspenders
      return [...prev, zip];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlreadySubscribed(false);

    if (!licenseOk) {
      setError("Verify your real estate license first (step 1).");
      return;
    }
    if (zips.length === 0) {
      setError("Pick at least one farm ZIP above.");
      return;
    }
    if (!name.trim()) {
      setError("Tell us your name.");
      return;
    }
    if (!email.trim()) {
      setError("Tell us where to send the digest (your email).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          farmZips: zips,
          licenseState,
          licenseNumber: licenseNumber.trim(),
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        alreadySubscribed?: boolean;
      };
      if (data.alreadySubscribed) {
        setAlreadySubscribed(true);
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || `Signup failed (${res.status})`);
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dg-card p-6 sm:p-8">
      {/* License verification */}
      <div>
        <h3 className="dg-serif text-lg font-bold" style={{ color: "var(--dg-navy)" }}>
          1. Verify your real estate license
        </h3>
        <p className="mt-1 text-sm" style={{ color: "var(--dg-muted)" }}>
          Licensed agents only. Missouri licenses are checked against the state registry
          instantly; Kansas licenses are verified by a human within a few hours.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--dg-muted)" }}>
              State
            </span>
            <select
              className="dg-input"
              value={licenseState}
              onChange={(e) => {
                setLicenseState(e.target.value as "MO" | "KS");
                resetLicense();
              }}
              disabled={verifying}
            >
              <option value="MO">Missouri</option>
              <option value="KS">Kansas</option>
            </select>
          </label>
          <label className="block grow sm:max-w-xs">
            <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--dg-muted)" }}>
              License number
            </span>
            <input
              type="text"
              className="dg-input"
              placeholder={licenseState === "MO" ? "e.g. 2024002937" : "e.g. SP00012345"}
              value={licenseNumber}
              onChange={(e) => {
                setLicenseNumber(e.target.value);
                resetLicense();
              }}
              maxLength={30}
              disabled={verifying}
              required
            />
          </label>
          <button
            type="button"
            className="dg-btn"
            onClick={handleVerify}
            disabled={verifying || licenseOk}
          >
            {verifying ? "Verifying…" : licenseOk ? "Verified ✓" : "Verify license"}
          </button>
        </div>

        {/* Progress bar */}
        {(verifying || verifyProgress > 0) && !license && (
          <div className="mt-4" role="status" aria-live="polite">
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "#e8e2d6" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-150 ease-out"
                style={{ width: `${verifyProgress}%`, background: "var(--dg-amber)" }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold" style={{ color: "var(--dg-muted)" }}>
              {VERIFY_STAGES[verifyStage]}
            </p>
          </div>
        )}

        {/* Result banners */}
        {license?.status === "verified" && (
          <div
            className="mt-4 rounded-lg border px-4 py-3 text-sm font-medium"
            style={{ borderColor: "#bfd9c9", background: "#eef7f1", color: "var(--dg-green)" }}
            role="status"
          >
            ✓ Verified with the state of Missouri: <b>{license.licenseeName}</b>
            {license.profession ? ` — ${license.profession}` : ""}
            {license.expirationDate ? `, expires ${license.expirationDate}` : ""}.
          </div>
        )}
        {license?.status === "manual_review" && (
          <div
            className="mt-4 rounded-lg border px-4 py-3 text-sm font-medium"
            style={{ borderColor: "#ead9ae", background: "#fbf6e9", color: "#8a6d1d" }}
            role="status"
          >
            License accepted pending a quick human check —{" "}
            {license.reason ?? "we'll verify it within a few hours"}. You can finish signing
            up now.
          </div>
        )}
        {license?.status === "invalid" && (
          <div
            className="mt-4 rounded-lg border px-4 py-3 text-sm font-medium"
            style={{ borderColor: "#e5b6a8", background: "#fdf0ec", color: "#9a3412" }}
            role="alert"
          >
            {license.reason ?? "We couldn't find an active license for that number."} Check
            the number and try again, or reply to any tolley.io email for help.
          </div>
        )}
      </div>

      {/* ZIP picker + contact — locked until the license clears */}
      <div
        style={
          licenseOk
            ? undefined
            : { opacity: 0.45, pointerEvents: "none", userSelect: "none" }
        }
        aria-disabled={!licenseOk}
      >
        {/* ZIP picker */}
        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="dg-serif text-lg font-bold" style={{ color: "var(--dg-navy)" }}>
              2. Pick your farm ZIPs
            </h3>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: zips.length >= MAX_ZIPS ? "var(--dg-amber)" : "var(--dg-muted)" }}
            >
              {zips.length}/{MAX_ZIPS} selected
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--dg-muted)" }}>
            Up to {MAX_ZIPS}. Your Monday email only contains leads inside these ZIPs.
          </p>
          <div className="mt-4 space-y-4">
            {DIGEST_COVERAGE_GROUPS.map((group) => (
              <div key={group.area}>
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--dg-muted)" }}
                >
                  {group.area}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {group.zips.map((zip) => {
                    const selected = zips.includes(zip);
                    return (
                      <button
                        key={zip}
                        type="button"
                        className="dg-zip"
                        aria-pressed={selected}
                        disabled={!selected && zips.length >= MAX_ZIPS}
                        onClick={() => toggleZip(zip)}
                      >
                        {zip}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="mt-8">
          <h3 className="dg-serif text-lg font-bold" style={{ color: "var(--dg-navy)" }}>
            3. Where should Monday&apos;s digest land?
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--dg-muted)" }}>
                Your name
              </span>
              <input
                type="text"
                className="dg-input"
                placeholder="Alex Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--dg-muted)" }}>
                Email
              </span>
              <input
                type="email"
                className="dg-input"
                placeholder="you@yourbrokerage.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                autoComplete="email"
                required
              />
            </label>
          </div>
        </div>
      </div>

      {/* Errors / already-subscribed */}
      {error && (
        <div
          className="mt-5 rounded-lg border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "#e5b6a8",
            background: "#fdf0ec",
            color: "#9a3412",
          }}
          role="alert"
        >
          {error}
        </div>
      )}
      {alreadySubscribed && (
        <div
          className="mt-5 rounded-lg border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "#bfd9c9",
            background: "#eef7f1",
            color: "var(--dg-green)",
          }}
          role="status"
        >
          You&apos;re already subscribed with this email — your next digest lands Monday 7am.
          Need to change ZIPs? Reply to any digest email.
        </div>
      )}

      {/* Submit */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="dg-btn dg-serif text-lg"
          disabled={submitting || !licenseOk}
        >
          {submitting ? "Opening secure checkout…" : "Start my free 3-day trial"}
        </button>
        <p className="text-xs" style={{ color: "var(--dg-muted)" }}>
          3 days free, then $199/mo founding rate, locked in. Secure checkout by Stripe.
          Cancel anytime.
        </p>
      </div>
    </form>
  );
}
