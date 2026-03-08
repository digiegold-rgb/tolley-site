import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import {
  LEGAL_BRAND,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
  LEGAL_OPT_IN_KEYWORDS,
  LEGAL_OPT_IN_MESSAGE,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions | T-Agent",
  description:
    "Terms and Conditions for T-Agent | Real Estate Unlocked by Tolley AI, including SMS A2P messaging disclosures.",
};

type TermsSection = {
  heading: string;
  paragraphs: string[];
};

const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: "1. Service Description",
    paragraphs: [
      "T-Agent | Real Estate Unlocked is a premium search portal and AI-assisted service designed to help real estate professionals with vendor recommendations, guidance, and deal-support information. Services may include web access, SMS messaging, and AI-generated responses.",
    ],
  },
  {
    heading: "2. Eligibility",
    paragraphs: ["You must be at least 18 years old to use the service."],
  },
  {
    heading: "3. Accounts and Access",
    paragraphs: [
      "You agree to provide accurate information and keep your credentials secure. You are responsible for activity under your account.",
    ],
  },
  {
    heading: "4. Acceptable Use",
    paragraphs: [
      "You agree not to use the service for unlawful, abusive, or fraudulent purposes; attempt unauthorized access; interfere with operations; submit harmful code; or send unauthorized messages.",
    ],
  },
  {
    heading: "5. AI and Informational Nature of Service",
    paragraphs: [
      "T-Agent may provide AI-generated suggestions, summaries, and recommendations. Outputs may be incomplete or inaccurate. You are responsible for independently verifying important information before relying on it for legal, financial, contractual, brokerage, or transaction decisions. Tolley AI does not provide legal advice.",
    ],
  },
  {
    heading: "8. Fees, Billing, and Subscriptions",
    paragraphs: [
      "Paid plans, billing terms, renewals, and cancellation terms are disclosed at purchase and/or in your subscription agreement. Failure to pay may result in suspension or termination.",
    ],
  },
  {
    heading: "9. Intellectual Property",
    paragraphs: [
      "Software, branding, logos, and platform content provided by Tolley AI are owned by or licensed to Tolley AI and protected by law. You may not copy, reverse engineer, resell, or exploit the service except where explicitly permitted.",
    ],
  },
  {
    heading: "10. User Content",
    paragraphs: [
      "You retain ownership of submitted content, and grant Tolley AI a limited license to use it for operating, maintaining, and improving the service. You represent you have rights to submit such content.",
    ],
  },
  {
    heading: "11. Third-Party Services",
    paragraphs: [
      "The service may integrate with third-party tools, vendors, listings, communications providers, and websites. Tolley AI is not responsible for third-party products or services.",
    ],
  },
  {
    heading: "12. Disclaimer of Warranties",
    paragraphs: [
      "The service is provided \"as is\" and \"as available\" without warranties of any kind, to the fullest extent permitted by law.",
    ],
  },
  {
    heading: "13. Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, Tolley AI is not liable for indirect, incidental, special, consequential, or punitive damages, or losses of profits, data, or business opportunities.",
    ],
  },
  {
    heading: "14. Indemnification",
    paragraphs: [
      "You agree to indemnify and hold harmless Tolley AI and its affiliates from claims arising from your use of the service, your content, or your violation of these Terms.",
    ],
  },
  {
    heading: "15. Suspension and Termination",
    paragraphs: [
      "Tolley AI may suspend or terminate access for violations of these Terms, misuse of the service, or legal/compliance risk.",
    ],
  },
  {
    heading: "16. Governing Law",
    paragraphs: [
      "These Terms are governed by the laws of the State of Missouri, without regard to conflict-of-law principles.",
    ],
  },
  {
    heading: "17. Changes to Terms",
    paragraphs: [
      "These Terms may be updated from time to time. Continued use after updates constitutes acceptance of revised Terms.",
    ],
  },
];

function TermsSectionBlock({ heading, paragraphs }: TermsSection) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white/94 sm:text-xl">{heading}</h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          {paragraph}
        </p>
      ))}
    </section>
  );
}

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms & Conditions"
      subtitle="These Terms govern your use of T-Agent and include SMS program disclosures required for A2P compliance review."
    >
      <section className="grid gap-3 rounded-2xl border border-white/14 bg-white/[0.03] p-4 text-sm text-white/84 sm:grid-cols-2 sm:text-[0.94rem]">
        <p>
          <span className="font-semibold text-white/94">Brand: </span>
          {LEGAL_BRAND}
        </p>
        <p>
          <span className="font-semibold text-white/94">Effective Date: </span>
          {LEGAL_EFFECTIVE_DATE}
        </p>
        <p>
          <span className="font-semibold text-white/94">Last Updated: </span>
          {LEGAL_LAST_UPDATED}
        </p>
        <p>
          <span className="font-semibold text-white/94">Support Email: </span>
          <a
            className="underline decoration-white/35 underline-offset-4"
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
          >
            {LEGAL_SUPPORT_EMAIL}
          </a>
        </p>
      </section>

      {TERMS_SECTIONS.slice(0, 5).map((section) => (
        <TermsSectionBlock
          key={section.heading}
          heading={section.heading}
          paragraphs={section.paragraphs}
        />
      ))}

      <section className="space-y-3 rounded-2xl border border-violet-200/25 bg-violet-300/[0.06] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white/95 sm:text-xl">
          6. SMS Messaging Terms (A2P / 10DLC)
        </h2>
        <p className="text-sm leading-6 text-white/84 sm:text-[0.95rem]">
          By opting in to SMS communications from Tolley AI / T-Agent, you consent to
          receive recurring text messages related to your requested service, including
          conversational responses, account/service updates, and support communications.
        </p>
        <ul className="space-y-2 text-sm leading-6 text-white/84 sm:text-[0.95rem]">
          <li>
            <span className="font-semibold text-white/94">Program Name: </span>
            T-Agent | Real Estate Unlocked (Tolley AI)
          </li>
          <li>
            <span className="font-semibold text-white/94">Message Purpose: </span>
            AI assistant communications for real estate guidance, vendor recommendations,
            and service-related updates.
          </li>
          <li>
            <span className="font-semibold text-white/94">Message Frequency: </span>
            Message frequency varies based on your usage and interactions.
          </li>
          <li>
            <span className="font-semibold text-white/94">Message and Data Rates: </span>
            Msg & data rates may apply.
          </li>
          <li>
            <span className="font-semibold text-white/94">Opt-Out: </span>
            Reply <strong>STOP</strong> to cancel SMS messages at any time.
          </li>
          <li>
            <span className="font-semibold text-white/94">Help: </span>
            Reply <strong>HELP</strong> for help or contact{" "}
            <a
              className="underline decoration-white/35 underline-offset-4"
              href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
            >
              {LEGAL_SUPPORT_EMAIL}
            </a>
            .
          </li>
          <li>
            <span className="font-semibold text-white/94">Consent: </span>
            SMS consent is not a condition of purchase.
          </li>
        </ul>
        <p className="text-sm leading-6 text-white/84 sm:text-[0.95rem]">
          <span className="font-semibold text-white/94">Opt-in keywords: </span>
          {LEGAL_OPT_IN_KEYWORDS.join(", ")}
        </p>
        <p className="rounded-xl border border-white/14 bg-black/25 p-3 text-sm leading-6 text-white/84 sm:text-[0.95rem]">
          <span className="font-semibold text-white/94">Opt-in message: </span>
          {LEGAL_OPT_IN_MESSAGE}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white/94 sm:text-xl">
          7. User Consent to Messaging
        </h2>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          You represent that you are the authorized user of the phone number provided,
          consent to receive requested messages, and can withdraw consent any time by
          replying <strong>STOP</strong>.
        </p>
      </section>

      {TERMS_SECTIONS.slice(5).map((section) => (
        <TermsSectionBlock
          key={section.heading}
          heading={section.heading}
          paragraphs={section.paragraphs}
        />
      ))}

      <section className="space-y-3 border-t border-white/14 pt-5">
        <h2 className="text-lg font-semibold text-white/94 sm:text-xl">
          18. Contact Information
        </h2>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          {LEGAL_BRAND}
          <br />
          Email:{" "}
          <a
            className="underline decoration-white/35 underline-offset-4"
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
          >
            {LEGAL_SUPPORT_EMAIL}
          </a>
          <br />
          Website: https://tolley.io
          <br />
          SMS Support: Reply <strong>HELP</strong> to your T-Agent number
        </p>
      </section>
    </LegalPageShell>
  );
}
