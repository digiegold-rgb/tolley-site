import {
  WD_STRIPE_CHECKOUT_URL,
  WD_PRICE_WASHER,
  WD_PRICE_BUNDLE,
} from "@/lib/wd";

const features = [
  "Free delivery & install",
  "Maintenance included",
  "Replacement coverage",
  "No contracts — cancel anytime",
];

export function WdPricing() {
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Washer Only */}
        <div className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(45,175,180,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <h2 className="text-lg font-semibold text-white/95">Washer Only</h2>
          <p className="mt-2">
            <span className="text-3xl font-bold text-white/95">${WD_PRICE_WASHER}</span>
            <span className="text-sm text-white/60">/mo</span>
          </p>
          <ul className="mt-4 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/80" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href={WD_STRIPE_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Get Started
          </a>
        </div>

        {/* Washer + Dryer Bundle */}
        <div className="relative rounded-3xl border border-teal-400/30 bg-[linear-gradient(160deg,rgba(255,255,255,0.18),rgba(45,175,180,0.14)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
          <span className="absolute top-4 right-4 rounded-full bg-teal-600/40 px-3 py-0.5 text-xs font-semibold tracking-wide text-teal-100 uppercase">
            Most Popular
          </span>
          <h2 className="text-lg font-semibold text-white/95">Washer + Dryer</h2>
          <p className="mt-2">
            <span className="text-3xl font-bold text-white/95">${WD_PRICE_BUNDLE}</span>
            <span className="text-sm text-white/60">/mo</span>
          </p>
          <ul className="mt-4 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/80" />
                {f}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-white/80">
              <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/80" />
              Full set — washer &amp; dryer together
            </li>
          </ul>
          <a
            href={WD_STRIPE_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(45,175,180,0.35)] transition hover:bg-teal-500"
          >
            Get Started
          </a>
        </div>
      </div>

      {/* Referral callout */}
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 text-center sm:p-5">
        <p className="text-sm font-semibold text-white/90">
          Refer a friend &rarr; 50% off your next month
        </p>
        <p className="mt-1 text-xs text-white/60">
          Ask us for details when you sign up or reach out anytime.
        </p>
      </div>
    </section>
  );
}
