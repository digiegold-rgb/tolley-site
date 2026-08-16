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
  ANIMATE_RENDER_RETENTION_DAYS,
  ANIMATE_RETENTION,
  ANIMATE_SUBPROCESSORS,
  TOS_VERSION,
} from "@/lib/legal-animate";

export const metadata: Metadata = {
  title: "Privacy Policy | Jelly Studio",
  description:
    "How Jelly Studio, operated by Your KC Homes LLC, collects, uses, shares, and retains your prompts, uploads, voice recordings, renders, and account data — including every named subprocessor.",
  alternates: { canonical: "https://www.tolley.io/animate/privacy" },
};

const SECTIONS: LegalSectionContent[] = [
  {
    heading: "1. Who we are and what this covers",
    paragraphs: [
      `${ANIMATE_LEGAL_BRAND} is operated by ${ANIMATE_LEGAL_ENTITY}, of ${ANIMATE_LEGAL_ADDRESS}. This policy covers the Studio at tolley.io/animate — your account, your projects, and everything you upload, generate, or publish through it.`,
      "It does not cover our other lines of business, which have their own policies, and it does not cover the platforms you publish to. Those are theirs.",
    ],
  },
  {
    heading: "2. What we collect",
    bullets: [
      "Account data: your email address, a hashed password, the date you accepted these terms and which version, and any name or profile details you add.",
      "Content you provide: scripts, prompts, topics, uploaded images and footage, reference audio, and voice recordings used for cloning.",
      "Content we generate for you: videos, images, audio, transcripts, captions, and the intermediate files a render produces.",
      "Job and cost data: render settings, model choices, durations, timestamps, success and failure states, and the itemized compute cost of every job.",
      "Billing data: your credit balance and purchase history, plus a Stripe customer and payment-method identifier. Card numbers are held by Stripe, never by us.",
      "Connected-account data: OAuth tokens and basic channel information for accounts you connect, such as a YouTube channel, and the metadata of what we publish for you.",
      "Technical data: IP address, browser and device details, pages and actions in the Studio, error traces, and timestamps.",
    ],
  },
  {
    heading: "3. What we do with it",
    bullets: [
      "Run the Studio: plan, render, transcode, store, and deliver your videos, and publish to accounts you have connected.",
      "Bill you accurately: meter compute at cost, apply the per-minute operations fee, draw down credits, and never charge for a failed render.",
      "Improve the Studio: debug failures, tune prompts and pipelines, measure quality and cost, and decide what to build. We do not sell your content or hand it to anyone to train a general-purpose model on.",
      "Promote the Studio: showcases, demo reels, sample galleries, and marketing — unless you have turned on the showcase opt-out, which we honor for all future marketing.",
      "Keep it safe and lawful: prevent abuse, investigate reports (including voice, likeness, and NCII reports), enforce our Terms, and comply with legal obligations.",
      "Support you: answer questions, and when needed open a logged support session that shows your account as you see it. We disclose that in the Terms rather than hiding it here.",
    ],
  },
  {
    heading: "4. What we do not do",
    bullets: [
      "We do not sell your personal information, and we do not share it for cross-context behavioral advertising.",
      "We do not read your projects out of curiosity. Access is for operating, supporting, and protecting the service.",
      "We do not use your content in marketing after you turn on the showcase opt-out.",
      "We do not run advertising networks or third-party ad trackers inside the Studio.",
    ],
  },
  {
    heading: "5. Who processes your data",
    paragraphs: [
      "Running a video pipeline means sending your material to other companies. We name every one of them, including where the processing happens, so you can make an informed decision before you paste anything sensitive into a prompt.",
    ],
    children: (
      <div className="space-y-3">
        <ul className="space-y-3">
          {ANIMATE_SUBPROCESSORS.map((sub) => (
            <li
              key={sub.name}
              className="rounded-2xl border border-white/12 bg-white/[0.03] p-3 text-sm leading-6 text-white/83 sm:p-4 sm:text-[0.94rem]"
            >
              <span className="font-semibold text-white/94">{sub.name}</span>
              {sub.location ? (
                <span className="ml-2 rounded-full border border-amber-200/30 bg-amber-300/10 px-2 py-0.5 text-[0.7rem] tracking-[0.08em] text-amber-100/90 uppercase">
                  {sub.location}
                </span>
              ) : null}
              {sub.planned ? (
                <span className="ml-2 rounded-full border border-white/20 bg-white/[0.06] px-2 py-0.5 text-[0.7rem] tracking-[0.08em] text-white/75 uppercase">
                  planned
                </span>
              ) : null}
              <p className="mt-1.5">{sub.purpose}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          We may also disclose information to law enforcement or other authorities where
          we are legally required to, and to a successor entity if the business is sold —
          in which case this policy travels with the data.
        </p>
      </div>
    ),
  },
  {
    heading: "6. Where your data is processed",
    emphasis: true,
    paragraphs: [
      "The Studio is hosted in the United States and intended for United States users. Most processing happens here — on Vercel, on Modal, and on a GPU server we own and administer in Missouri.",
      "One exception is worth stating loudly: some long-context script planning is routed to Moonshot AI's Kimi models, which are operated by a provider in China, accessed through a LiteLLM gateway. Prompts routed to that model are processed outside the United States and are subject to that provider's own handling. Do not put confidential, personal, or sensitive material into a prompt if that matters to you.",
    ],
  },
  {
    heading: "7. How long we keep things",
    children: (
      <ul className="space-y-3">
        {ANIMATE_RETENTION.map((row) => (
          <li
            key={row.data}
            className="rounded-2xl border border-white/12 bg-white/[0.03] p-3 text-sm leading-6 text-white/83 sm:p-4 sm:text-[0.94rem]"
          >
            <span className="font-semibold text-white/94">{row.data}</span>
            <p className="mt-1.5">{row.period}</p>
          </li>
        ))}
      </ul>
    ),
  },
  {
    heading: "8. About your delivery links",
    emphasis: true,
    paragraphs: [
      `Finished videos are served from our content delivery network at unlisted URLs. Unlisted means the address is long and not indexed or listed anywhere public. It does not mean private: anyone who has the link can open the file without signing in.`,
      `Share delivery links the way you would share a password, and download anything you would not want a stranger to be able to open. Renders are deleted after ${ANIMATE_RENDER_RETENTION_DAYS} days unless you download or pin them.`,
    ],
  },
  {
    heading: "9. Your choices and rights",
    bullets: [
      "Showcase opt-out: a toggle in your account. Turn it on and we stop using your inputs and outputs in new marketing, showcases, and demos. It applies going forward; material already published may stay up.",
      "Access, correction, and deletion: email us and we will tell you what we hold, fix what is wrong, and delete what you ask us to delete — subject to the billing records we must keep for tax purposes.",
      "Account closure: ask us and we close the account and delete your content on the schedule in Section 7.",
      "Disconnect a platform: you can disconnect YouTube or any connected account inside the Studio at any time, which deletes the stored tokens.",
      "Marketing email: every non-transactional email has an unsubscribe link. Service and billing notices are not optional while you have an account.",
    ],
    children: (
      <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
        <span className="font-semibold text-white/94">California residents: </span>
        we extend the CCPA rights to know, delete, correct, and opt out of sale or sharing
        to every user as a courtesy, regardless of where you live, and we do not
        discriminate against you for exercising them. We do not sell or share personal
        information as those terms are defined, but we honor{" "}
        <span className="font-semibold text-white/94">Global Privacy Control</span> signals
        as an opt-out request anyway. Submit requests to{" "}
        <a
          className="underline decoration-white/35 underline-offset-4"
          href={`mailto:${ANIMATE_LEGAL_EMAIL}`}
        >
          {ANIMATE_LEGAL_EMAIL}
        </a>{" "}
        from the address on your account; we respond within 45 days.
      </p>
    ),
  },
  {
    heading: "10. YouTube API Services and Google data",
    children: (
      <div className="space-y-3 text-sm leading-6 text-white/83 sm:text-[0.95rem]">
        <p>
          {ANIMATE_LEGAL_BRAND} uses YouTube API Services. When you connect a channel, we
          receive and store an OAuth access and refresh token, your channel ID and name,
          and the metadata of uploads and analytics we retrieve on your behalf. We use it
          only to publish and manage the videos you ask us to publish, and to show you
          performance data in the Studio.
        </p>
        <p>
          By using those features you agree to the{" "}
          <a
            href={ANIMATE_LINKS.youtubeTerms}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-200 underline underline-offset-2 transition hover:text-white"
          >
            YouTube Terms of Service
          </a>
          . Google&apos;s Privacy Policy applies to Google&apos;s own handling of that
          information and is available at{" "}
          <a
            href={ANIMATE_LINKS.googlePrivacy}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-200 underline underline-offset-2 transition hover:text-white"
          >
            {ANIMATE_LINKS.googlePrivacy}
          </a>
          .
        </p>
        <p>
          You can revoke the Studio&apos;s access to your Google and YouTube data at any
          time through the Google security settings page at{" "}
          <a
            href={ANIMATE_LINKS.googleSecuritySettings}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-200 underline underline-offset-2 transition hover:text-white"
          >
            {ANIMATE_LINKS.googleSecuritySettings}
          </a>
          , or by disconnecting the channel in the Studio. Revoking access stops future
          publishing; stored tokens are deleted, and YouTube data we cached is deleted
          within 30 days.
        </p>
      </div>
    ),
  },
  {
    heading: "11. Security",
    bullets: [
      "Traffic is encrypted in transit. Passwords are stored hashed, never in plaintext.",
      "Card data never touches our servers — Stripe holds it, and we hold only an identifier.",
      "Access to production data is limited to operators who need it, and support sessions that view your account are logged.",
      "No system is perfectly secure. If a breach affects your data, we will notify you as required by law.",
    ],
  },
  {
    heading: "12. Children",
    paragraphs: [
      "The Studio is for adults. You must be 18 or older to have an account. We do not knowingly collect information from anyone under 18, and if we learn we have, we delete it. If you believe a minor has an account, email us.",
    ],
  },
  {
    heading: "13. Changes to this policy",
    paragraphs: [
      `We may update this policy. The version and dates at the top change when we do, and material changes are sent to the email on your account. This is version ${TOS_VERSION}.`,
    ],
  },
  {
    heading: "14. Contact",
    paragraphs: [
      `${ANIMATE_LEGAL_ENTITY}, ${ANIMATE_LEGAL_ADDRESS}. Email ${ANIMATE_LEGAL_EMAIL} for privacy requests, data deletion, or anything in this policy you want explained.`,
    ],
  },
];

export default function AnimatePrivacyPage() {
  return (
    <LegalPageShell
      kicker="jelly studio · beta"
      title="Privacy Policy"
      subtitle="What Jelly Studio collects, who else touches it, where in the world it goes, how long it stays, and how to get it deleted. Sections 5, 6 and 8 are the ones people are usually surprised by."
    >
      <section className="grid gap-3 rounded-2xl border border-white/14 bg-white/[0.03] p-4 text-sm text-white/84 sm:grid-cols-2 sm:text-[0.94rem]">
        <p>
          <span className="font-semibold text-white/94">Service: </span>
          {ANIMATE_LEGAL_BRAND}
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
          <span className="font-semibold text-white/94">Hosting: </span>
          United States
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
          href={ANIMATE_LINKS.beta}
          className="underline decoration-white/35 underline-offset-4 transition hover:text-white"
        >
          Beta Addendum
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
