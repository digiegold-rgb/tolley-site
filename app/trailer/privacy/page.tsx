import type { Metadata } from "next";
import Link from "next/link";

import { TR_BRAND, TR_COMPANY, TR_CONTACT_EMAIL, TR_CONTACT_PHONE } from "@/lib/trailer";

export const metadata: Metadata = {
  title: "Privacy Policy | Trailer Rental",
  description:
    "Privacy Policy for Trailer Rental by Your KC Homes LLC. How we handle your information.",
};

type PrivacySection = {
  heading: string;
  items: string[];
};

const sections: PrivacySection[] = [
  {
    heading: "1. Information We Collect",
    items: [
      "Name, phone number, and email provided when booking.",
      "Driver\u2019s license information presented at pickup (for verification only).",
      "Payment information processed at time of rental.",
      "Rental records including dates, trailer used, and condition notes.",
    ],
  },
  {
    heading: "2. How We Use Your Information",
    items: [
      "Process rental reservations and payments.",
      "Verify renter identity via driver\u2019s license.",
      "Communicate about your rental, availability, and support.",
      "Maintain records for damage claims and dispute resolution.",
      "Comply with legal obligations.",
    ],
  },
  {
    heading: "3. Information Sharing",
    items: [
      "We do not sell, rent, or share your personal information for marketing.",
      "Information may be shared with payment processors, insurance providers (in case of damage claims), or legal authorities when required by law.",
    ],
  },
  {
    heading: "4. Payment Processing",
    items: [
      "We accept cash, card, Venmo, Zelle, and CashApp.",
      "Card payments are processed through secure payment processors. We do not store full card numbers.",
      "Cash payments are recorded in our rental logs.",
    ],
  },
  {
    heading: "5. Driver\u2019s License Data",
    items: [
      "Your driver\u2019s license is verified in person at pickup.",
      "We may record your license number for our rental records.",
      "License information is used solely for renter verification and is not shared with third parties except as required by law.",
    ],
  },
  {
    heading: "6. Data Retention",
    items: [
      "Rental records are retained for a reasonable period for legal and operational purposes.",
      "You may request deletion of your data by contacting us.",
    ],
  },
  {
    heading: "7. Data Security",
    items: [
      "We use reasonable safeguards to protect your information.",
      "No method of storage is 100% secure.",
    ],
  },
  {
    heading: "8. Your Rights",
    items: [
      "You may request access to, correction of, or deletion of your personal information.",
      "Contact us at any time with privacy questions or requests.",
    ],
  },
  {
    heading: "9. Governing Law",
    items: [
      "This privacy policy is governed by the laws of the State of Missouri.",
    ],
  },
];

function Section({ heading, items }: PrivacySection) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black tracking-wide text-amber-400 uppercase sm:text-xl">
        {heading}
      </h2>
      <ul className="space-y-2.5 text-sm font-light leading-6 text-neutral-400 sm:text-[0.95rem]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="trailer-bullet" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TrailerPrivacyPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 py-10 sm:px-8 sm:py-14">
      <section className="mx-auto max-w-4xl rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-10">
        <header className="mb-8 border-b border-neutral-800 pb-6">
          <p className="text-xs font-bold tracking-[0.3em] text-amber-500/70 uppercase">
            {TR_BRAND}
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-wide text-white uppercase sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-light leading-6 text-neutral-400">
            How {TR_BRAND} ({TR_COMPANY}) collects, uses, and protects your information.
          </p>
        </header>

        <div className="space-y-7">
          {sections.map((section) => (
            <Section key={section.heading} heading={section.heading} items={section.items} />
          ))}
        </div>

        <section className="mt-8 space-y-3 border-t border-neutral-800 pt-5">
          <h2 className="text-lg font-black tracking-wide text-amber-400 uppercase sm:text-xl">
            10. Related Documents
          </h2>
          <p className="text-sm font-light leading-6 text-neutral-400">
            See our{" "}
            <Link
              href="/trailer/terms"
              className="font-bold text-amber-400 underline decoration-amber-500/30 underline-offset-4 transition hover:text-amber-300"
            >
              Rental Terms &amp; Conditions
            </Link>{" "}
            for full rental agreement.
          </p>
        </section>

        <section className="mt-7 space-y-3 border-t border-neutral-800 pt-5">
          <h2 className="text-lg font-black tracking-wide text-amber-400 uppercase sm:text-xl">
            11. Contact Us
          </h2>
          <p className="text-sm font-light leading-6 text-neutral-400">
            {TR_BRAND} ({TR_COMPANY})
            <br />
            Email:{" "}
            <a className="text-amber-400 underline decoration-amber-500/30 underline-offset-4" href={`mailto:${TR_CONTACT_EMAIL}`}>
              {TR_CONTACT_EMAIL}
            </a>
            <br />
            Phone:{" "}
            <a className="text-amber-400 underline decoration-amber-500/30 underline-offset-4" href={`tel:${TR_CONTACT_PHONE}`}>
              {TR_CONTACT_PHONE}
            </a>
          </p>
        </section>

        <div className="mt-7 rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-center text-xs text-neutral-500">
          Last updated: March 2026
        </div>
      </section>
    </main>
  );
}
