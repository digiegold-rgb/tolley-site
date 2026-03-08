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
      "Stripe\u2019s privacy policy governs how they handle your payment data.",
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
      <h2 className="text-lg font-bold text-blue-900 sm:text-xl">{heading}</h2>
      <ul className="space-y-2.5 text-sm leading-6 text-slate-700 sm:text-[0.95rem]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="wd-bullet" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function WdPrivacyPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <section className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/40 sm:p-10">
        <header className="mb-8 border-b border-blue-100 pb-6">
          <p className="text-xs font-semibold tracking-[0.3em] text-blue-400 uppercase">
            Wash &amp; Dry Rental
          </p>
          <h1 className="mt-3 text-2xl font-bold text-blue-900 sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
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

        <section className="mt-8 space-y-3 border-t border-blue-100 pt-5">
          <h2 className="text-lg font-bold text-blue-900 sm:text-xl">
            9. Related Documents
          </h2>
          <p className="text-sm leading-6 text-slate-700">
            See our{" "}
            <Link
              href="/wd/terms"
              className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
            >
              Rental Agreement
            </Link>{" "}
            for full terms of service.
          </p>
        </section>

        <section className="mt-7 space-y-3 border-t border-blue-100 pt-5">
          <h2 className="text-lg font-bold text-blue-900 sm:text-xl">
            10. Contact Us
          </h2>
          <p className="text-sm leading-6 text-slate-700">
            {WD_BRAND} (DBA {WD_COMPANY})
            <br />
            Email:{" "}
            <a
              className="text-blue-600 underline decoration-blue-300 underline-offset-4"
              href={`mailto:${WD_CONTACT_EMAIL}`}
            >
              {WD_CONTACT_EMAIL}
            </a>
            <br />
            Phone:{" "}
            <a
              className="text-blue-600 underline decoration-blue-300 underline-offset-4"
              href={`tel:${WD_CONTACT_PHONE}`}
            >
              {WD_CONTACT_PHONE}
            </a>
          </p>
        </section>

        <div className="mt-7 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-center text-xs text-slate-500">
          Last updated: March 2026
        </div>
      </section>
    </main>
  );
}
