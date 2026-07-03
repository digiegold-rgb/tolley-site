import Link from "next/link";
import { LEADS_TIERS } from "@/lib/leads-subscription";

export function HpPricing() {
  return (
    <section id="pricing" className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8">
      <div className="mb-10 text-center">
        <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
          Pricing
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[0.02em] text-white/95 sm:text-4xl">
          Simple, transparent plans
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/72">
          No hidden fees. Cancel anytime. 7-day free trial included.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {LEADS_TIERS.map((tier) => (
          tier.popular ? (
            <div key={tier.id} className="hp-shimmer-border group relative rounded-3xl border border-violet-200/40 bg-violet-300/10 p-6 shadow-[0_16px_40px_rgba(59,25,95,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_56px_rgba(59,25,95,0.6)] sm:p-8">
              <span className="absolute top-5 right-5 rounded-full border border-violet-100/40 bg-violet-100/20 px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.1em] text-violet-50 uppercase">
                Most Popular
              </span>
              <p className="text-xs tracking-[0.14em] text-violet-100/82 uppercase">{tier.name}</p>
              <p className="mt-3 text-4xl font-semibold text-white">
                ${tier.price}<span className="text-base text-white/68">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white/82">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check violet /><span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/leads/pricing"
                className="mt-6 block w-full rounded-full border border-violet-200/45 bg-violet-300/20 px-4 py-3 text-center text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition-all hover:bg-violet-300/28 hover:shadow-[0_0_24px_rgba(139,92,246,0.25)]"
              >
                Start {tier.name}
              </Link>
            </div>
          ) : (
            <div key={tier.id} className="group rounded-3xl border border-white/18 bg-black/28 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/28 hover:shadow-[0_20px_50px_rgba(0,0,0,0.52)] sm:p-8">
              <p className="text-xs tracking-[0.14em] text-white/66 uppercase">{tier.name}</p>
              <p className="mt-3 text-4xl font-semibold text-white">
                ${tier.price}<span className="text-base text-white/68">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white/78">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check /><span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/leads/pricing"
                className="mt-6 block w-full rounded-full border border-white/22 bg-white/[0.07] px-4 py-3 text-center text-xs font-semibold tracking-[0.1em] text-white uppercase transition-all hover:bg-white/[0.12] hover:border-white/30"
              >
                Start {tier.name}
              </Link>
            </div>
          )
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <a
          href="mailto:support@tolley.io?subject=T-Agent%20Sales%20Inquiry"
          className="rounded-full border border-white/22 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold tracking-[0.1em] text-white/88 uppercase transition-all hover:bg-white/[0.1] hover:border-white/30"
        >
          Talk to us
        </a>
      </div>
    </section>
  );
}

function Check({ violet }: { violet?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`mt-0.5 shrink-0 ${violet ? "text-violet-300/80" : "text-white/50"}`}
    >
      <path
        d="M13.5 4.5L6.5 11.5L2.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
