"use client";

import { useState } from "react";
import { LEADS_TIERS } from "@/lib/leads-subscription";
import LeadsPricingActions from "./LeadsPricingActions";

type Props = {
  isLoggedIn: boolean;
  currentTier: string | null;
};

export default function LeadsPricingClient({ isLoggedIn, currentTier }: Props) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const isAnnual = interval === "annual";

  return (
    <>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span
          className={`text-sm font-medium transition-colors ${
            !isAnnual ? "text-white" : "text-white/40"
          }`}
        >
          Monthly
        </span>
        <button
          onClick={() => setInterval(isAnnual ? "monthly" : "annual")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isAnnual ? "bg-purple-500" : "bg-white/20"
          }`}
          role="switch"
          aria-checked={isAnnual}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isAnnual ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium transition-colors flex items-center gap-2 ${
            isAnnual ? "text-white" : "text-white/40"
          }`}
        >
          Annual
          <span className="rounded-full bg-green-500/20 border border-green-500/30 px-2 py-0.5 text-[0.65rem] font-bold text-green-400 uppercase tracking-wider">
            Save 20%
          </span>
        </span>
      </div>

      {/* Pricing cards */}
      <div className="grid sm:grid-cols-3 gap-6 mb-16">
        {LEADS_TIERS.map((tier) => {
          const displayPrice = isAnnual ? Math.round(tier.price * 0.8) : tier.price;

          return (
            <div
              key={tier.id}
              className={`relative rounded-2xl border p-6 ${
                tier.popular
                  ? "border-purple-500/50 bg-purple-900/10"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-purple-500 px-3 py-0.5 text-[0.65rem] font-bold text-white uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">${displayPrice}</span>
                  <span className="text-white/40 text-sm">/month</span>
                </div>
                {isAnnual && (
                  <p className="text-xs text-white/40 mt-1">
                    ${displayPrice * 12}/year &mdash; saves ${(tier.price - displayPrice) * 12}/yr
                  </p>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <LeadsPricingActions
                tierId={tier.id}
                interval={interval}
                isLoggedIn={isLoggedIn}
                isCurrent={currentTier === tier.id}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
