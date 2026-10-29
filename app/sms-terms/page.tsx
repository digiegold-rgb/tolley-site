import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { CK_EMAIL, CK_PHONE, CK_PHONE_TEL } from "@/lib/legal-cleanouts";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.tolley.io/sms-terms" },
  title: "SMS Terms | Tolley Cleanouts",
  description:
    "SMS terms for Tolley Cleanouts texts: appointment confirmations, quotes, and job updates. Message frequency varies. Msg & data rates may apply.",
};

export default function SmsTermsPage() {
  return (
    <LegalPageShell
      title="SMS Terms"
      subtitle="These terms describe the Tolley Cleanouts text-message program."
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white/94 sm:text-xl">Program</h2>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          <span className="font-semibold text-white/94">Program name: </span>
          Tolley Cleanouts texts.
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          <span className="font-semibold text-white/94">Message types: </span>
          appointment confirmations, quotes, job updates.
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          Message frequency varies.
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          Msg &amp; data rates may apply.
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          <strong>Reply STOP to opt out, HELP for help.</strong>
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          Consent is not a condition of purchase. A quote request can be submitted without agreeing to texts.
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          Carriers are not liable for delayed or undelivered messages.
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          <span className="font-semibold text-white/94">Support: </span>
          <a className="underline decoration-white/35 underline-offset-4" href={CK_PHONE_TEL}>
            {CK_PHONE}
          </a>
          {" · "}
          <a className="underline decoration-white/35 underline-offset-4" href={`mailto:${CK_EMAIL}`}>
            {CK_EMAIL}
          </a>
        </p>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          <a className="underline decoration-white/35 underline-offset-4" href="/privacy">
            Privacy Policy
          </a>
          {" · "}
          <a className="underline decoration-white/35 underline-offset-4" href="/terms">
            Terms
          </a>
        </p>
      </section>
    </LegalPageShell>
  );
}
