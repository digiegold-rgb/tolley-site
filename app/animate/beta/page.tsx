import type { Metadata } from "next";
import Link from "next/link";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { LegalSection, type LegalSectionContent } from "@/components/legal/legal-section";
import {
  ANIMATE_LEGAL_ADDRESS,
  ANIMATE_LEGAL_BRAND,
  ANIMATE_LEGAL_EFFECTIVE_DATE,
  ANIMATE_LEGAL_EMAIL,
  ANIMATE_LEGAL_ENTITY,
  ANIMATE_LEGAL_LAST_UPDATED,
  ANIMATE_LINKS,
  ANIMATE_OPS_RATE_PER_MIN,
  ANIMATE_PROMO_CREDIT_EXPIRY_DAYS,
  ANIMATE_RENDER_RETENTION_DAYS,
  TOS_VERSION,
} from "@/lib/legal-animate";

export const metadata: Metadata = {
  title: "Beta Addendum | Jelly Studio",
  description:
    "The Jelly Studio beta in plain English — what beta means, what a video actually costs with a worked example, how credits work, and what we may show off.",
  alternates: { canonical: "https://www.tolley.io/animate/beta" },
};

/* Worked example: a 3:24 finished video. 3.4 minutes x the ops rate, plus the
 * metered compute the job actually consumed. Kept as arithmetic rather than a
 * hardcoded string so the number cannot drift away from the rate constant. */
const EXAMPLE_MINUTES = 3 + 24 / 60;
const EXAMPLE_OPS = EXAMPLE_MINUTES * ANIMATE_OPS_RATE_PER_MIN;
const EXAMPLE_COMPUTE = 1.0;

const SECTIONS: LegalSectionContent[] = [
  {
    heading: "1. What beta means here",
    paragraphs: [
      "It means the software is unfinished and we are being honest about it. Renders fail. Models get swapped out. Features appear and disappear. A thing that worked last Tuesday may not work today.",
      "There is no service level agreement, no uptime promise, and no guarantee that any feature, model, or price survives. If your business depends on a video shipping at a specific hour, do not depend on the beta for it.",
      "In exchange you get the real pipeline at cost plus a thin fee, and a direct line to the person building it.",
    ],
  },
  {
    heading: "2. What a video costs",
    emphasis: true,
    paragraphs: [
      `Two numbers, added together. Compute at cost — what the GPUs, models, and voices actually charged us for your job, passed through with no markup. Plus an operations fee of $${ANIMATE_OPS_RATE_PER_MIN.toFixed(2)} per finished minute of delivered video.`,
      "You see an estimate before the render starts, and the itemized actual after it finishes. The actual is what you pay.",
    ],
    children: (
      <div className="rounded-2xl border border-white/14 bg-black/25 p-4 text-sm leading-6 text-white/86 sm:p-5 sm:text-[0.95rem]">
        <p className="text-[0.7rem] tracking-[0.28em] text-white/60 uppercase">
          Worked example — a 3:24 video
        </p>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-4">
            <dt>
              Operations fee — 3.4 min × ${ANIMATE_OPS_RATE_PER_MIN.toFixed(2)}/min
            </dt>
            <dd className="font-semibold text-white/94">${EXAMPLE_OPS.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Compute at cost — GPU, models, voice</dt>
            <dd className="font-semibold text-white/94">
              ≈ ${EXAMPLE_COMPUTE.toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-white/14 pt-2">
            <dt className="font-semibold text-white/94">All-in</dt>
            <dd className="font-semibold text-white/94">
              ≈ ${(EXAMPLE_OPS + EXAMPLE_COMPUTE).toFixed(2)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-white/70">
          Compute varies with the models and shot count a job uses — that half of the bill
          is metered, not quoted. The operations fee is fixed per finished minute.
        </p>
      </div>
    ),
  },
  {
    heading: "3. Failed renders are free",
    paragraphs: [
      "If a job errors out, gets cancelled by us, or does not produce a usable file, you are not charged. If credits were already drawn, they go back. You do not pay for our bugs.",
    ],
  },
  {
    heading: "4. Credits and your card",
    bullets: [
      "You prepay for credits, and renders draw them down. There is no subscription and no monthly minimum.",
      "Adding a card does not charge it. We store it with Stripe so that buying credits later is one click.",
      "Credits you buy never expire.",
      `Credits we gift you expire ${ANIMATE_PROMO_CREDIT_EXPIRY_DAYS} days after we grant them, and are spent before your purchased ones.`,
      "Prepaid credits are not refundable — except that if we shut the Studio down or close your account for any reason other than your breach of the Terms, we refund the unused purchased balance.",
    ],
  },
  {
    heading: "5. Your work is yours",
    paragraphs: [
      "You own what you make. We do not claim your videos.",
      "We do ask for permission to show them off — a showcase page, a demo reel, a social post about what the Studio can do. If you would rather we did not, flip the showcase opt-out in your account and we will keep your work out of all future marketing. Anything already published may stay up.",
      "Separately from marketing, we keep the permission we need to actually run the service: store your files, send them to the model providers, and deliver them back to you. That part is not optional, because it is the product.",
    ],
  },
  {
    heading: "6. Two things that will get you in real trouble",
    emphasis: true,
    bullets: [
      "Cloning a voice you do not have permission to clone. Your own voice, or documented consent from the person whose voice it is. Not a celebrity, not a politician, not a voice actor. State laws in Tennessee, California, and New York make this personally expensive, and the liability is yours.",
      "Making a real person appear to say or do something they did not. That includes deepfakes, fabricated endorsements, and fake reviews or testimonials — the FTC fines per violation for those.",
    ],
    children: (
      <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
        The full list is in Sections 9 and 10 of the{" "}
        <Link
          href={ANIMATE_LINKS.terms}
          className="text-violet-200 underline underline-offset-2 transition hover:text-white"
        >
          Terms
        </Link>
        . Non-consensual intimate imagery is removed within 48 hours of a credible report
        and the account is terminated.
      </p>
    ),
  },
  {
    heading: "7. Say that it is AI",
    paragraphs: [
      "You are the publisher, so the disclosure duty is yours. YouTube wants realistic synthetic content flagged at upload. The FTC wants AI involvement disclosed in advertising and endorsements. Do both — it costs you nothing and it is the difference between a channel and a problem.",
    ],
  },
  {
    heading: "8. Download your finals",
    paragraphs: [
      `Finished videos live on our CDN for ${ANIMATE_RENDER_RETENTION_DAYS} days after delivery unless you download or pin them, then they are deleted. The Studio is a factory, not an archive.`,
      "Delivery links are unlisted, not private. Anyone with the URL can open the file. Treat the link like a password.",
    ],
  },
  {
    heading: "9. Things may change",
    paragraphs: [
      "Prices, models, and features can change during the beta. Material changes to pricing or to how credits work will be posted here and emailed to you before they take effect.",
      "Your invitation is personal and not transferable. Do not pass it around.",
    ],
  },
  {
    heading: "10. How to reach a human",
    paragraphs: [
      `Email ${ANIMATE_LEGAL_EMAIL}. Billing questions, a render that came out wrong, a takedown, a privacy request, or the opinion that something here is unfair — all the same address, and a person reads it.`,
    ],
  },
];

export default function AnimateBetaPage() {
  return (
    <LegalPageShell
      kicker="jelly studio · beta"
      title="Beta Addendum"
      subtitle="The short, plain-English version of what you are signing up for. It is part of the Terms — where the two say the same thing differently, the Terms control."
    >
      <section className="grid gap-3 rounded-2xl border border-white/14 bg-white/[0.03] p-4 text-sm text-white/84 sm:grid-cols-2 sm:text-[0.94rem]">
        <p>
          <span className="font-semibold text-white/94">Service: </span>
          {ANIMATE_LEGAL_BRAND} (beta)
        </p>
        <p>
          <span className="font-semibold text-white/94">Operator: </span>
          {ANIMATE_LEGAL_ENTITY}
        </p>
        <p>
          <span className="font-semibold text-white/94">Effective: </span>
          {ANIMATE_LEGAL_EFFECTIVE_DATE}
        </p>
        <p>
          <span className="font-semibold text-white/94">Last updated: </span>
          {ANIMATE_LEGAL_LAST_UPDATED} (version {TOS_VERSION})
        </p>
        <p>
          <span className="font-semibold text-white/94">Address: </span>
          {ANIMATE_LEGAL_ADDRESS}
        </p>
        <p>
          <span className="font-semibold text-white/94">Contact: </span>
          <a
            className="underline decoration-white/35 underline-offset-4"
            href={`mailto:${ANIMATE_LEGAL_EMAIL}`}
          >
            {ANIMATE_LEGAL_EMAIL}
          </a>
        </p>
      </section>

      {SECTIONS.map((section) => (
        <LegalSection key={section.heading} {...section} />
      ))}

      <section className="flex flex-wrap gap-x-4 gap-y-2 border-t border-white/14 pt-5 text-sm text-white/78">
        <Link
          href={ANIMATE_LINKS.terms}
          className="underline decoration-white/35 underline-offset-4 transition hover:text-white"
        >
          Terms of Service
        </Link>
        <Link
          href={ANIMATE_LINKS.privacy}
          className="underline decoration-white/35 underline-offset-4 transition hover:text-white"
        >
          Privacy Policy
        </Link>
        <Link
          href="/animate"
          className="underline decoration-white/35 underline-offset-4 transition hover:text-white"
        >
          Back to the Studio
        </Link>
      </section>
    </LegalPageShell>
  );
}
