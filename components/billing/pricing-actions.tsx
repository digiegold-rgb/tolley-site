"use client";

import Link from "next/link";
import { useState } from "react";

type PricingActionsProps = {
  isAuthenticated: boolean;
  currentTier: "none" | "basic" | "premium";
  basicPriceId: string;
  premiumPriceId: string;
};

type PlanType = "basic" | "premium";

export function PricingActions({
  isAuthenticated,
  currentTier,
  basicPriceId,
  premiumPriceId,
}: PricingActionsProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const startCheckout = async (plan: PlanType) => {
    if (!isAuthenticated) {
      return;
    }

    setLoadingPlan(plan);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: plan === "premium" ? premiumPriceId : basicPriceId,
        }),
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setErrorMessage(data.error || "Unable to start checkout.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setErrorMessage("Unable to start checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const openPortal = async () => {
    if (!isAuthenticated) {
      return;
    }

    setOpeningPortal(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setErrorMessage(data.error || "Unable to open billing portal.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setErrorMessage("Unable to open billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/18 bg-black/28 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <p className="text-xs tracking-[0.14em] text-white/66 uppercase">Basic</p>
          <p className="mt-2 text-3xl font-semibold text-white">$500<span className="text-base text-white/68">/mo</span></p>
          <ul className="mt-4 space-y-2 text-sm text-white/78">
            <li>Agent builder + dashboard</li>
            <li>Up to 10 agents</li>
            <li>Up to 3 integrations</li>
            <li>Standard support</li>
          </ul>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void startCheckout("basic")}
              disabled={loadingPlan !== null || currentTier === "basic"}
              className="mt-5 w-full rounded-full border border-white/22 bg-white/[0.07] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white uppercase transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {currentTier === "basic"
                ? "Current Plan"
                : loadingPlan === "basic"
                  ? "Starting..."
                  : "Start Basic"}
            </button>
          ) : (
            <Link
              href="/signup?callbackUrl=%2Fpricing"
              className="mt-5 block w-full rounded-full border border-white/22 bg-white/[0.07] px-4 py-2 text-center text-xs font-semibold tracking-[0.1em] text-white uppercase transition hover:bg-white/[0.12]"
            >
              Start Basic
            </Link>
          )}
        </div>

        <div className="relative rounded-3xl border border-violet-200/40 bg-violet-300/10 p-5 shadow-[0_16px_40px_rgba(59,25,95,0.45)] backdrop-blur-xl">
          <span className="absolute top-4 right-4 rounded-full border border-violet-100/40 bg-violet-100/20 px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.1em] text-violet-50 uppercase">
            Best Value
          </span>
          <p className="text-xs tracking-[0.14em] text-violet-100/82 uppercase">Premium</p>
          <p className="mt-2 text-3xl font-semibold text-white">$800<span className="text-base text-white/68">/mo</span></p>
          <ul className="mt-4 space-y-2 text-sm text-white/82">
            <li>Everything in Basic</li>
            <li>Up to 50 agents</li>
            <li>Advanced tooling + premium tools</li>
            <li>Priority support + faster SLA</li>
          </ul>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void startCheckout("premium")}
              disabled={loadingPlan !== null || currentTier === "premium"}
              className="mt-5 w-full rounded-full border border-violet-200/45 bg-violet-300/20 px-4 py-2 text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {currentTier === "premium"
                ? "Current Plan"
                : loadingPlan === "premium"
                  ? "Starting..."
                  : "Start Premium"}
            </button>
          ) : (
            <Link
              href="/signup?callbackUrl=%2Fpricing"
              className="mt-5 block w-full rounded-full border border-violet-200/45 bg-violet-300/20 px-4 py-2 text-center text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28"
            >
              Start Premium
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href="mailto:support@tolley.io?subject=T-Agent%20Sales%20Inquiry"
          className="rounded-full border border-white/22 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/88 uppercase transition hover:bg-white/[0.1]"
        >
          Talk to us
        </a>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={openingPortal}
            className="rounded-full border border-white/22 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/88 uppercase transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {openingPortal ? "Opening..." : "Manage Billing"}
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-3 text-sm text-rose-200/90">{errorMessage}</p>
      ) : null}
    </>
  );
}
