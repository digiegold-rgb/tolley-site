"use client";

import Link from "next/link";
import { useState } from "react";

type FoodBillingClientProps = {
  hasAccess: boolean;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  checkoutCanceled: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return null;
  const diffMs = date - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function FoodBillingClient({
  hasAccess,
  status,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  hasStripeCustomer,
  checkoutCanceled,
}: FoodBillingClientProps) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading("checkout");
    setError(null);
    try {
      const res = await fetch("/api/stripe/food/checkout", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to start checkout");
      }
      const { url } = await res.json();
      if (typeof url === "string") {
        window.location.href = url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/stripe/food/portal", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to open billing portal");
      }
      const { url } = await res.json();
      if (typeof url === "string") {
        window.location.href = url;
        return;
      }
      throw new Error("No portal URL returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  const trialDaysLeft = daysUntil(trialEndsAt);
  const periodDaysLeft = daysUntil(currentPeriodEnd);
  const isTrialing = status === "trialing";
  const isActive = status === "active";
  const isPastDue = status === "past_due";
  const isCanceled = status === "canceled";

  return (
    <div
      className="food-card"
      style={{
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          marginBottom: "0.5rem",
        }}
      >
        🍳 Ruthann&apos;s Kitchen
      </h1>

      {checkoutCanceled && (
        <div
          style={{
            margin: "1rem auto 1.5rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(251, 191, 36, 0.1)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            color: "#b45309",
            fontSize: "0.875rem",
            maxWidth: 480,
          }}
        >
          Checkout was canceled. Your card was not charged.
        </div>
      )}

      {!hasAccess && !isPastDue && !isCanceled && (
        <>
          <p
            style={{
              fontSize: "1.0625rem",
              color: "var(--food-text-secondary)",
              margin: "0.5rem auto 2rem",
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            Start your 30-day free trial. Full access to meal planning, grocery
            lists, pantry tracking, receipt scanning, and AI recipes.
          </p>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              background:
                "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1,
              margin: "0 0 0.25rem",
            }}
          >
            $39<span style={{ fontSize: "1.125rem", color: "var(--food-text-secondary)" }}>
              /year
            </span>
          </div>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--food-text-secondary)",
              margin: "0 0 1.5rem",
            }}
          >
            After the 30-day free trial · cancel anytime
          </p>
          <button
            type="button"
            onClick={startCheckout}
            disabled={loading !== null}
            className="food-btn food-btn-primary food-glow"
            style={{
              fontSize: "1rem",
              padding: "0.875rem 2rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading === "checkout" ? "Starting…" : "Start 30-day free trial"}
          </button>
        </>
      )}

      {isTrialing && (
        <>
          <div
            style={{
              margin: "1rem auto 1.5rem",
              padding: "1rem 1.25rem",
              borderRadius: "0.875rem",
              background:
                "linear-gradient(135deg, rgba(110, 231, 183, 0.14), rgba(192, 132, 252, 0.12))",
              border: "1px solid rgba(110, 231, 183, 0.3)",
              maxWidth: 480,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, fontSize: "1.0625rem" }}>
              ✨ Free trial active
            </p>
            <p
              style={{
                margin: "0.375rem 0 0",
                color: "var(--food-text-secondary)",
                fontSize: "0.9375rem",
              }}
            >
              {trialDaysLeft !== null
                ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left`
                : "Trial is running"}
              {trialEndsAt && ` · renews ${formatDate(trialEndsAt)}`}
            </p>
          </div>
          <Link href="/food" className="food-btn food-btn-primary">
            Back to your kitchen →
          </Link>
          {hasStripeCustomer && (
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={openPortal}
                disabled={loading !== null}
                className="food-btn food-btn-secondary"
                style={{
                  fontSize: "0.875rem",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading === "portal" ? "Opening…" : "Manage billing"}
              </button>
            </div>
          )}
        </>
      )}

      {isActive && (
        <>
          <div
            style={{
              margin: "1rem auto 1.5rem",
              padding: "1rem 1.25rem",
              borderRadius: "0.875rem",
              background: "rgba(110, 231, 183, 0.12)",
              border: "1px solid rgba(110, 231, 183, 0.3)",
              maxWidth: 480,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, fontSize: "1.0625rem" }}>
              ✅ Active subscription — $39/year
            </p>
            {currentPeriodEnd && (
              <p
                style={{
                  margin: "0.375rem 0 0",
                  color: "var(--food-text-secondary)",
                  fontSize: "0.9375rem",
                }}
              >
                {cancelAtPeriodEnd
                  ? `Cancels on ${formatDate(currentPeriodEnd)}`
                  : `Renews ${formatDate(currentPeriodEnd)}`}
                {periodDaysLeft !== null && periodDaysLeft <= 14 && !cancelAtPeriodEnd &&
                  ` (${periodDaysLeft} day${periodDaysLeft !== 1 ? "s" : ""} left)`}
              </p>
            )}
          </div>
          <Link href="/food" className="food-btn food-btn-primary">
            Back to your kitchen →
          </Link>
          {hasStripeCustomer && (
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={openPortal}
                disabled={loading !== null}
                className="food-btn food-btn-secondary"
              >
                {loading === "portal" ? "Opening…" : "Manage billing"}
              </button>
            </div>
          )}
        </>
      )}

      {isPastDue && (
        <>
          <div
            style={{
              margin: "1rem auto 1.5rem",
              padding: "1rem 1.25rem",
              borderRadius: "0.875rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#b91c1c",
              maxWidth: 480,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, fontSize: "1.0625rem" }}>
              ⚠️ Payment failed
            </p>
            <p
              style={{
                margin: "0.375rem 0 0",
                fontSize: "0.9375rem",
              }}
            >
              Please update your payment method to keep access.
            </p>
          </div>
          {hasStripeCustomer && (
            <button
              type="button"
              onClick={openPortal}
              disabled={loading !== null}
              className="food-btn food-btn-primary food-glow"
            >
              {loading === "portal" ? "Opening…" : "Update payment method"}
            </button>
          )}
        </>
      )}

      {isCanceled && (
        <>
          <p
            style={{
              fontSize: "1rem",
              color: "var(--food-text-secondary)",
              margin: "1rem auto 1.5rem",
              maxWidth: 480,
            }}
          >
            Your subscription is canceled. Resubscribe anytime — your data is
            safe and waiting.
          </p>
          <button
            type="button"
            onClick={startCheckout}
            disabled={loading !== null}
            className="food-btn food-btn-primary food-glow"
          >
            {loading === "checkout" ? "Starting…" : "Resubscribe ($39/year)"}
          </button>
        </>
      )}

      {error && (
        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.24)",
            color: "#b91c1c",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
