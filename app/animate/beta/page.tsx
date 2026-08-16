import type { Metadata } from "next";
import Link from "next/link";

import { MicroLabel } from "@/components/animate/cinema";
import {
  CinemaLegalMeta,
  CinemaLegalShell,
} from "@/components/animate/legal/CinemaLegalShell";
import {
  CinemaLegalSection,
  LEGAL_BODY_STYLE,
  LEGAL_LINK_STYLE,
  LEGAL_STRONG_STYLE,
} from "@/components/animate/legal/CinemaLegalSection";
import type { LegalSectionContent } from "@/components/legal/legal-section";
import { JELLY_TOKENS } from "@/components/animate/tokens";
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

/* Receipt rows in the worked example — laid out like a box-office stub. */
const EXAMPLE_ROW: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 16,
  fontFamily: JELLY_TOKENS.font,
  fontSize: 14.5,
  lineHeight: 1.6,
  color: JELLY_TOKENS.dark.textSecondary,
};

const EXAMPLE_FIGURE: React.CSSProperties = {
  margin: 0,
  fontWeight: 600,
  whiteSpace: "nowrap",
  color: JELLY_TOKENS.dark.text,
};

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
      <div
        style={{
          background: JELLY_TOKENS.dark.cardAlt,
          border: `1px solid ${JELLY_TOKENS.dark.border}`,
          borderRadius: JELLY_TOKENS.radius.xl,
          padding: 20,
        }}
      >
        <MicroLabel tone="cyan" size={10.5} tracking="0.28em" as="p" style={{ whiteSpace: "normal" }}>
          Worked example — a 3:24 video
        </MicroLabel>
        <dl
          style={{
            margin: "14px 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={EXAMPLE_ROW}>
            <dt style={{ margin: 0 }}>
              Operations fee — 3.4 min × ${ANIMATE_OPS_RATE_PER_MIN.toFixed(2)}/min
            </dt>
            <dd className="jc-tabular" style={EXAMPLE_FIGURE}>
              ${EXAMPLE_OPS.toFixed(2)}
            </dd>
          </div>
          <div style={EXAMPLE_ROW}>
            <dt style={{ margin: 0 }}>Compute at cost — GPU, models, voice</dt>
            <dd className="jc-tabular" style={EXAMPLE_FIGURE}>
              ≈ ${EXAMPLE_COMPUTE.toFixed(2)}
            </dd>
          </div>
          <div
            style={{
              ...EXAMPLE_ROW,
              borderTop: `1px dashed ${JELLY_TOKENS.dark.borderStrong}`,
              paddingTop: 10,
            }}
          >
            <dt style={{ ...LEGAL_STRONG_STYLE, margin: 0 }}>All-in</dt>
            <dd
              className="jc-tabular"
              style={{ ...EXAMPLE_FIGURE, color: JELLY_TOKENS.cyan }}
            >
              ≈ ${(EXAMPLE_OPS + EXAMPLE_COMPUTE).toFixed(2)}
            </dd>
          </div>
        </dl>
        <p
          style={{
            ...LEGAL_BODY_STYLE,
            marginTop: 14,
            fontSize: 13,
            color: JELLY_TOKENS.dark.textFaint,
          }}
        >
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
      <p style={LEGAL_BODY_STYLE}>
        The full list is in Sections 9 and 10 of the{" "}
        <Link href={ANIMATE_LINKS.terms} className="jc-link" style={LEGAL_LINK_STYLE}>
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
    <CinemaLegalShell
      kicker="Jelly Studio — Beta"
      title="Beta Addendum"
      subtitle="The short, plain-English version of what you are signing up for. It is part of the Terms — where the two say the same thing differently, the Terms control."
    >
      <CinemaLegalMeta
        rows={[
          { label: "Service", value: `${ANIMATE_LEGAL_BRAND} (beta)` },
          { label: "Operator", value: ANIMATE_LEGAL_ENTITY },
          { label: "Effective", value: ANIMATE_LEGAL_EFFECTIVE_DATE },
          {
            label: "Last updated",
            value: `${ANIMATE_LEGAL_LAST_UPDATED} (version ${TOS_VERSION})`,
          },
          { label: "Address", value: ANIMATE_LEGAL_ADDRESS },
          {
            label: "Contact",
            value: (
              <a
                href={`mailto:${ANIMATE_LEGAL_EMAIL}`}
                className="jc-link"
                style={LEGAL_LINK_STYLE}
              >
                {ANIMATE_LEGAL_EMAIL}
              </a>
            ),
          },
        ]}
      />

      {SECTIONS.map((section) => (
        <CinemaLegalSection key={section.heading} {...section} />
      ))}

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 20px",
          borderTop: `1px solid ${JELLY_TOKENS.dark.border}`,
          paddingTop: 22,
        }}
      >
        <Link href={ANIMATE_LINKS.terms} className="jc-link" style={LEGAL_LINK_STYLE}>
          Terms of Service
        </Link>
        <Link href={ANIMATE_LINKS.privacy} className="jc-link" style={LEGAL_LINK_STYLE}>
          Privacy Policy
        </Link>
        <Link href="/animate" className="jc-link" style={LEGAL_LINK_STYLE}>
          Back to the Studio
        </Link>
      </section>
    </CinemaLegalShell>
  );
}
