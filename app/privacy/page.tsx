import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import {
  LEGAL_BRAND,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | T-Agent",
  description:
    "Privacy Policy for T-Agent | Real Estate Unlocked by Tolley AI, including SMS/mobile data handling and consent protections.",
};

type PrivacySection = {
  heading: string;
  items: string[];
};

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: "1. Information We Collect",
    items: [
      "Contact information: name, phone number, email address, and brokerage/company name.",
      "Account information: login profile details and subscription status.",
      "Communications data: messages sent via SMS, web chat, email, and support channels.",
      "Usage data: pages visited, searches performed, clicks, device/browser details, IP address, and timestamps.",
      "Transaction data: billing status, plan details, and payment processor records (full payment card numbers are not stored by Tolley AI).",
      "User-submitted content: requests, notes, preferences, and vendor/service inquiries.",
    ],
  },
  {
    heading: "2. How We Use Information",
    items: [
      "Operate and deliver T-Agent | Real Estate Unlocked services.",
      "Send service-related communications and requested SMS messages.",
      "Respond to support requests and account questions.",
      "Improve search quality, recommendations, and product performance.",
      "Maintain security, prevent abuse, and detect fraud.",
      "Process subscriptions and administer accounts.",
      "Comply with legal obligations.",
    ],
  },
  {
    heading: "3. SMS / Mobile Information Privacy",
    items: [
      "If you opt in to SMS messages, your mobile number and consent are used to provide the messaging service you requested.",
      "No mobile information will be shared with third parties/affiliates for marketing or promotional purposes.",
      "All categories above exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.",
    ],
  },
  {
    heading: "4. How We Share Information",
    items: [
      "Information may be shared with service providers/subprocessors (hosting, analytics, messaging delivery, support), payment processors, professional advisors, legal authorities when required, and during permitted business transfers.",
      "Tolley AI does not sell personal information for third-party marketing.",
    ],
  },
  {
    heading: "5. Cookies and Analytics",
    items: [
      "Cookies and similar technologies may be used to keep you signed in, remember preferences, understand usage, and improve performance.",
      "You can manage cookies in your browser settings.",
    ],
  },
  {
    heading: "6. Data Retention",
    items: [
      "Personal information is retained only as long as reasonably necessary to provide service, maintain records, resolve disputes, enforce agreements, and satisfy legal obligations.",
    ],
  },
  {
    heading: "7. Data Security",
    items: [
      "Reasonable administrative, technical, and organizational safeguards are used to protect information. No transmission or storage method is 100% secure.",
    ],
  },
  {
    heading: "8. Your Choices and Rights",
    items: [
      "You may update account information, opt out of non-essential communications, and request deletion subject to legal and operational retention requirements.",
      "You may opt out of SMS at any time by replying STOP and request help by replying HELP.",
    ],
  },
  {
    heading: "9. Children's Privacy",
    items: [
      "T-Agent is intended for business use by adults in the real estate industry and is not directed to children under 13.",
    ],
  },
  {
    heading: "10. Third-Party Links and Services",
    items: [
      "The platform may link to third-party websites, vendors, or tools. Tolley AI is not responsible for their privacy practices.",
    ],
  },
  {
    heading: "11. Changes to This Privacy Policy",
    items: [
      "This policy may be updated from time to time. The latest version will be posted with an updated Last Updated date.",
    ],
  },
];

function Section({ heading, items }: PrivacySection) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white/94 sm:text-xl">{heading}</h2>
      <ul className="space-y-2.5 text-sm leading-6 text-white/83 sm:text-[0.95rem]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200/80" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="This Privacy Policy explains what Tolley AI collects, how it is used, and how your information is protected when using T-Agent."
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

      {PRIVACY_SECTIONS.map((section) => (
        <Section key={section.heading} heading={section.heading} items={section.items} />
      ))}

      <section className="space-y-3 border-t border-white/14 pt-5">
        <h2 className="text-lg font-semibold text-white/94 sm:text-xl">12. Contact Us</h2>
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
          SMS Support: Reply HELP to your T-Agent number
        </p>
      </section>
    </LegalPageShell>
  );
}
