import type { Metadata } from "next";
import Link from "next/link";

import { WD_BRAND, WD_COMPANY, WD_CONTACT_EMAIL, WD_CONTACT_PHONE } from "@/lib/wd";

export const metadata: Metadata = {
  title: "Privacy Policy | Wash & Dry Rental",
  description:
    "Privacy Policy for Wash & Dry Rental (DBA YourKCHomes). How we collect, use, and protect your information.",
};

type PrivacySection = {
  heading: string;
  items: string[];
};

const sections: PrivacySection[] = [
  {
    heading: "1. Information We Collect",
    items: [
      "Name, address, phone number, and email provided during sign-up.",
      "Payment information processed securely through Stripe. We do not store full card numbers.",
      "Service records including delivery address, equipment details, and maintenance history.",
    ],
  },
  {
    heading: "2. How We Use Your Information",
    items: [
      "Process monthly subscription payments and manage your account.",
      "Schedule delivery, installation, maintenance, and pickup of equipment.",
      "Communicate about your service, billing, and support requests.",
      "Comply with legal obligations.",
    ],
  },
  {
    heading: "3. Information Sharing",
    items: [
      "We do not sell, rent, or share your personal information for marketing purposes.",
      "Information may be shared with Stripe (payment processing) and service providers necessary to operate the rental service.",
      "We may disclose information when required by law or to protect our rights.",
    ],
  },
  {
    heading: "4. Payment Processing",
    items: [
      "All payments are processed through Stripe, a PCI-compliant payment processor.",
      "We do not store credit card numbers on our systems.",
      "Stripe's privacy policy governs how they handle your payment data.",
    ],
  },
  {
    heading: "5. Data Retention",
    items: [
      "Account and service records are retained for the duration of your subscription and a reasonable period afterward for legal and operational purposes.",
      "You may request deletion of your data by contacting us.",
    ],
  },
  {
    heading: "6. Data Security",
    items: [
      "We use reasonable administrative and technical safeguards to protect your information.",
      "No method of transmission or storage is 100% secure.",
    ],
  },
  {
    heading: "7. Your Rights",
    items: [
      "You may request access to, correction of, or deletion of your personal information.",
      "You may cancel your subscription at any time through the Stripe customer portal or by contacting us.",
    ],
  },
  {
    heading: "8. Governing Law",
    items: [
      "This privacy policy is governed by the laws of the State of Missouri.",
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
            <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/80" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function WdPrivacyPage() {
  return (
    <main className="legal-page relative min-h-screen px-5 pt-10 pb-24 sm:px-8 sm:pt-14">
      <div aria-hidden="true" className="portal-spotlight wd-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight wd-spotlight-right" />
      <section className="wd-legal-card relative mx-auto w-full max-w-4xl rounded-3xl p-6 sm:p-10">
        <header className="mb-8 border-b border-white/14 pb-6">
          <p className="text-[0.7rem] tracking-[0.38em] text-white/66 uppercase">
            wash &amp; dry rental
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[0.01em] text-white/95 sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78 sm:text-[0.96rem]">
            How {WD_BRAND} (DBA {WD_COMPANY}) collects, uses, and protects your
            information.
          </p>
        </header>

        <div className="space-y-7">
          {sections.map((section) => (
            <Section
              key={section.heading}
              heading={section.heading}
              items={section.items}
            />
          ))}
        </div>

        <section className="mt-8 space-y-3 border-t border-white/14 pt-5">
          <h2 className="text-lg font-semibold text-white/94 sm:text-xl">
            9. Related Documents
          </h2>
          <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
            See our{" "}
            <Link
              href="/wd/terms"
              className="text-teal-200 underline decoration-white/30 underline-offset-4 transition hover:text-white"
            >
              Rental Agreement
            </Link>{" "}
            for full terms of service.
          </p>
        </section>

        <section className="mt-7 space-y-3 border-t border-white/14 pt-5">
          <h2 className="text-lg font-semibold text-white/94 sm:text-xl">
            10. Contact Us
          </h2>
          <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
            {WD_BRAND} (DBA {WD_COMPANY})
            <br />
            Email:{" "}
            <a
              className="underline decoration-white/35 underline-offset-4"
              href={`mailto:${WD_CONTACT_EMAIL}`}
            >
              {WD_CONTACT_EMAIL}
            </a>
            <br />
            Phone:{" "}
            <a
              className="underline decoration-white/35 underline-offset-4"
              href={`tel:${WD_CONTACT_PHONE}`}
            >
              {WD_CONTACT_PHONE}
            </a>
          </p>
        </section>

        <div className="mt-7 rounded-2xl border border-white/14 bg-white/[0.03] p-4 text-center text-xs text-white/50">
          Last updated: March 2026
        </div>
      </section>
    </main>
  );
}
