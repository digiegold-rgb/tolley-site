/**
 * /leads/digest/welcome — Stripe Checkout success landing.
 *
 * Pure confirmation: the webhook (lib/digest-subscription.ts) has already (or
 * is about to) flip the DigestSubscriber row active, so there's nothing to do
 * here but set expectations. Not indexable — it's a post-purchase page.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're in — KC Motivated Seller Digest",
  robots: { index: false, follow: false },
};

const NEXT_STEPS = [
  {
    title: "Monday, 7:00am CT",
    desc: "Your first digest lands: the top 10 motivated-seller leads in your farm ZIPs from the past week, ranked by motivation score.",
  },
  {
    title: "Pick three, reach out",
    desc: "Every lead includes a pre-filled outreach script. Agents who win with this call or mail 3–5 leads the same week they arrive.",
  },
  {
    title: "Need anything? Just reply",
    desc: "Replies to any digest email go straight to Jared — ZIP changes, script tweaks, questions about a specific lead.",
  },
];

export default function DigestWelcomePage() {
  return (
    <div className="dg-sheet mx-auto my-2 max-w-[760px]">
      <div className="px-6 py-12 sm:px-12 sm:py-16">
        <div className="dg-rule" aria-hidden="true" />
        <p className="dg-kicker mt-6">KC Motivated Seller Digest</p>
        <h1
          className="dg-serif mt-4 text-4xl font-black leading-tight sm:text-5xl"
          style={{ color: "var(--dg-navy)" }}
        >
          You&apos;re in — first digest lands{" "}
          <em style={{ color: "var(--dg-amber)" }}>Monday 7am.</em>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed" style={{ color: "var(--dg-muted)" }}>
          Payment confirmed. Your subscription is active and your farm ZIPs are loaded —
          there&apos;s nothing else to set up.
        </p>

        <div className="mt-10 space-y-4">
          {NEXT_STEPS.map((step, i) => (
            <div key={step.title} className="dg-card flex gap-4 p-5">
              <div className="dg-serif text-2xl font-black" style={{ color: "var(--dg-amber)" }}>
                {i + 1}
              </div>
              <div>
                <h2 className="dg-serif text-lg font-bold" style={{ color: "var(--dg-navy)" }}>
                  {step.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--dg-muted)" }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs" style={{ color: "var(--dg-muted)" }}>
          Your Stripe receipt is on its way to your inbox — it includes the billing portal
          link for managing or canceling the subscription. Every digest email also carries
          a one-click &ldquo;Pause your digest&rdquo; link.
        </p>
        <div className="dg-rule mt-8" aria-hidden="true" />
      </div>
    </div>
  );
}
