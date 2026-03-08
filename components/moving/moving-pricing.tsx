import { MV_PRICE_DAY, MV_PRICE_WEEK, MV_PRICE_2WEEK, MV_CONTACT_PHONE } from "@/lib/moving";

const tiers = [
  { label: "Day", duration: "24 hours", price: MV_PRICE_DAY },
  { label: "Week", duration: "7 full days", price: MV_PRICE_WEEK },
  { label: "2 Weeks", duration: "14 full days", price: MV_PRICE_2WEEK },
];

export function MovingPricing() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
      <h2 className="mv-neon-text text-2xl font-black tracking-wide text-emerald-400 uppercase sm:text-3xl">
        Pricing
      </h2>
      <p className="mt-2 text-sm font-light text-neutral-400">
        Save hundreds compared to buying boxes, tape, and blankets. All payments processed via Stripe.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <a
            key={tier.label}
            href={`tel:${MV_CONTACT_PHONE}`}
            className="mv-card group flex flex-col items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-5 text-center transition-all hover:border-emerald-500/50"
          >
            <span className="text-xs font-bold tracking-[0.3em] text-emerald-400/70 uppercase">
              {tier.label}
            </span>
            <span className="mt-2 text-4xl font-black text-white">
              ${tier.price}
            </span>
            <span className="mt-1 text-xs font-light text-neutral-500">
              {tier.duration}
            </span>
            <span className="mt-3 inline-block rounded bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 uppercase transition group-hover:bg-emerald-500 group-hover:text-black">
              Book Now
            </span>
          </a>
        ))}
      </div>

      {/* Payment & policies */}
      <div className="mt-6 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
        <h3 className="font-black tracking-wide text-emerald-400 uppercase">
          How It Works
        </h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            "Call or text to reserve your date",
            "Pick up or local delivery available",
            "Use for your move — easy labels included",
            "Return everything when you're done",
            "All payments accepted — cash, card, Venmo, Zelle, CashApp",
            "Payments processed securely via Stripe",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <span className="mv-bullet" />
              <span className="font-light text-neutral-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
