"use client";

/**
 * Signup form + grouped ZIP picker for the KC Motivated Seller Digest.
 * POSTs to /api/leads/digest/subscribe and redirects to Stripe Checkout.
 * Every failure path surfaces inline — no silent catches.
 */

import { useState } from "react";

import { DIGEST_COVERAGE_GROUPS } from "@/lib/leads/digest-coverage";

const MAX_ZIPS = 7;

export default function DigestSignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zips, setZips] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

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

    if (!name.trim()) {
      setError("Tell us your name.");
      return;
    }
    if (!email.trim()) {
      setError("Tell us where to send the digest (your email).");
      return;
    }
    if (zips.length === 0) {
      setError("Pick at least one farm ZIP above.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), farmZips: zips }),
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
      {/* ZIP picker */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="dg-serif text-lg font-bold" style={{ color: "var(--dg-navy)" }}>
            1. Pick your farm ZIPs
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
          2. Where should Monday&apos;s digest land?
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
        <button type="submit" className="dg-btn dg-serif text-lg" disabled={submitting}>
          {submitting ? "Opening secure checkout…" : "Start my digest — $199/mo"}
        </button>
        <p className="text-xs" style={{ color: "var(--dg-muted)" }}>
          Founding rate, locked in. Secure checkout by Stripe. Cancel anytime.
        </p>
      </div>
    </form>
  );
}
