import Link from "next/link";

import { auth } from "@/auth";
import { PricingActions } from "@/components/billing/pricing-actions";
import { getUserBillingState } from "@/lib/billing-state";
import { getPriceIds } from "@/lib/billing";
import { normalizePlanTier } from "@/lib/subscription";

function safePriceIds() {
  try {
    return getPriceIds();
  } catch {
    return {
      basic: "price_basic_missing",
      premium: "price_premium_missing",
    };
  }
}

const comparisonRows = [
  { feature: "Included agents", basic: "Up to 10", premium: "Up to 50" },
  { feature: "Integrations", basic: "Up to 3", premium: "Up to 15" },
  { feature: "Automations", basic: "Standard", premium: "Advanced workflows" },
  { feature: "Audit logs", basic: "Basic logs", premium: "Advanced audit logs" },
  { feature: "Team seats", basic: "2 seats", premium: "10 seats" },
  { feature: "Support SLA", basic: "Standard support", premium: "Priority support" },
];

const testimonials = [
  {
    quote:
      "We moved from scattered tools to one agent workflow and cut follow-up time in half.",
    byline: "Ops Lead, Mid-Market Brokerage",
  },
  {
    quote:
      "Premium gave us the guardrails and reliability we needed for high-volume lead routing.",
    byline: "Broker/Owner, Multi-Team Office",
  },
  {
    quote:
      "The billing and setup flow is clean. New agents are live without engineering overhead.",
    byline: "Director of Growth, Real Estate Group",
  },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Use Manage Billing in your account to cancel at any time.",
  },
  {
    q: "Does Premium include everything in Basic?",
    a: "Yes. Premium includes all Basic features plus higher limits, advanced tooling, and priority support.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual billing is coming soon. Current plans are monthly subscriptions.",
  },
];

export default async function PricingPage() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);
  const billingState = session?.user?.id
    ? await getUserBillingState(session.user.id)
    : null;
  const currentTier = normalizePlanTier(billingState?.subscriptionTier);
  const priceIds = safePriceIds();

  return (
    <main className="portal-shell ambient-noise relative min-h-screen overflow-hidden px-5 py-10 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 mx-auto w-full max-w-6xl space-y-8">
        <header className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
            t-agent
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white/95 sm:text-4xl">
            Deploy AI agents that actually do work.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
            Launch real-estate operations agents with reliable billing, clear controls, and
            production-ready guardrails.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs tracking-[0.1em] text-white/60 uppercase">
            <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
              Used by growing teams
            </span>
            <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
              Secure by design
            </span>
            <span className="rounded-full border border-white/18 bg-black/25 px-3 py-1">
              Stripe-powered billing
            </span>
          </div>
        </header>

        <section className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <PricingActions
            isAuthenticated={isAuthenticated}
            currentTier={currentTier}
            basicPriceId={priceIds.basic}
            premiumPriceId={priceIds.premium}
          />
          {isAuthenticated ? (
            <p className="mt-3 text-xs tracking-[0.1em] text-white/58 uppercase">
              Current plan: {currentTier === "none" ? "No active subscription" : currentTier}
            </p>
          ) : (
            <p className="mt-3 text-sm text-white/72">
              Already have an account?{" "}
              <Link href="/login?callbackUrl=%2Fpricing" className="text-violet-200 hover:text-white">
                Sign in
              </Link>
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">Plan Comparison</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/15">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-black/28 text-white/80">
                <tr>
                  <th className="px-4 py-3 font-semibold">Feature</th>
                  <th className="px-4 py-3 font-semibold">Basic</th>
                  <th className="px-4 py-3 font-semibold text-violet-100">Premium</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="border-t border-white/10">
                    <td className="px-4 py-3 text-white/76">{row.feature}</td>
                    <td className="px-4 py-3 text-white/88">{row.basic}</td>
                    <td className="px-4 py-3 text-violet-100">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <article
              key={item.byline}
              className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(129,75,229,0.09)),rgba(8,7,15,0.56)] p-5 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl"
            >
              <p className="text-sm leading-7 text-white/82">“{item.quote}”</p>
              <p className="mt-3 text-xs tracking-[0.08em] text-white/62 uppercase">{item.byline}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">FAQ</h2>
          <div className="mt-4 space-y-4">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/12 bg-black/22 p-4">
                <h3 className="text-sm font-semibold text-white/90">{item.q}</h3>
                <p className="mt-1 text-sm leading-7 text-white/74">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
