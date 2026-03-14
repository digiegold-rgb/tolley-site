import { Suspense } from "react";
import {
  WD_STRIPE_CHECKOUT_WASHER_URL,
  WD_STRIPE_CHECKOUT_URL,
  WD_PRICE_WASHER,
  WD_PRICE_BUNDLE,
} from "@/lib/wd";
import { WdCheckoutLink } from "./wd-checkout-link";

const features = [
  "Free delivery & install",
  "Maintenance included",
  "Replacement coverage",
  "No contracts — cancel anytime",
];

export function WdPricing() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Washer Only */}
        <div className="wd-card rounded-2xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/40 sm:p-8">
          <h2 className="text-lg font-bold text-blue-900">Washer Only</h2>
          <p className="mt-2">
            <span className="text-4xl font-extrabold text-blue-600">
              ${WD_PRICE_WASHER}
            </span>
            <span className="text-slate-500">/mo</span>
          </p>
          <ul className="mt-4 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="wd-bullet" />
                {f}
              </li>
            ))}
          </ul>
          <Suspense fallback={
            <a
              href={WD_STRIPE_CHECKOUT_WASHER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full border-2 border-blue-200 bg-white px-6 py-2.5 text-sm font-bold text-blue-600 transition-all hover:bg-blue-50 hover:border-blue-300"
            >
              Get Started
            </a>
          }>
            <WdCheckoutLink
              href={WD_STRIPE_CHECKOUT_WASHER_URL}
              label="washer_pricing"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full border-2 border-blue-200 bg-white px-6 py-2.5 text-sm font-bold text-blue-600 transition-all hover:bg-blue-50 hover:border-blue-300"
            >
              Get Started
            </WdCheckoutLink>
          </Suspense>
        </div>

        {/* Washer + Dryer Bundle */}
        <div className="wd-card relative rounded-2xl border-2 border-blue-400 bg-white p-6 shadow-xl shadow-blue-200/40 sm:p-8">
          <span className="pulse-ring absolute -top-3 right-6 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold tracking-wide text-white uppercase shadow-md shadow-blue-600/30" style={{ "--pulse-color": "rgba(37, 99, 235, 0.4)" } as React.CSSProperties}>
            Most Popular
          </span>
          <h2 className="text-lg font-bold text-blue-900">Washer + Dryer</h2>
          <p className="mt-2">
            <span className="text-4xl font-extrabold text-blue-600">
              ${WD_PRICE_BUNDLE}
            </span>
            <span className="text-slate-500">/mo</span>
          </p>
          <ul className="mt-4 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="wd-bullet" />
                {f}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-slate-700">
              <span className="wd-bullet" />
              Full set — washer &amp; dryer together
            </li>
          </ul>
          <Suspense fallback={
            <a
              href={WD_STRIPE_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="wd-glow mt-6 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-700"
            >
              Get Started
            </a>
          }>
            <WdCheckoutLink
              href={WD_STRIPE_CHECKOUT_URL}
              label="bundle_pricing"
              className="wd-glow mt-6 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-700"
            >
              Get Started
            </WdCheckoutLink>
          </Suspense>
        </div>
      </div>

      {/* Referral callout */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 p-5 text-center shadow-sm">
        <p className="text-sm font-bold text-blue-800">
          Refer a friend &rarr; 50% off your next month
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Ask us for details when you sign up or reach out anytime.
        </p>
      </div>
    </div>
  );
}
