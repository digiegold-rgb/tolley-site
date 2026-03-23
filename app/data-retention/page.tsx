import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import {
  LEGAL_BRAND,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data Retention & Disposal Policy | T-Agent",
  description:
    "Data Retention and Disposal Policy for Your KC Homes LLC, covering retention schedules, disposal procedures, and compliance with applicable laws.",
};

type Section = {
  heading: string;
  items: string[];
};

const SECTIONS: Section[] = [
  {
    heading: "1. Purpose",
    items: [
      "This policy defines how Your KC Homes LLC retains, archives, and disposes of data to ensure compliance with applicable laws, minimize risk, and protect privacy.",
    ],
  },
  {
    heading: "2. Scope",
    items: [
      "This policy applies to all data collected, processed, or stored by the Company, including financial transaction data from bank account integrations (Plaid), invoice and payment records (Stripe), customer and vendor contact information, and system logs and backups.",
    ],
  },
  {
    heading: "3. Retention Schedule",
    items: [
      "Bank transaction data (Plaid): 7 years from transaction date — IRS record retention requirement.",
      "Invoice records: 7 years from invoice date — IRS record retention requirement.",
      "Payment records (Stripe): 7 years from payment date — IRS record retention requirement.",
      "Customer and vendor contacts: Duration of business relationship plus 1 year.",
      "API access tokens (Plaid, Stripe): Duration of active integration — revoked via provider API when no longer needed.",
      "OAuth refresh tokens: Until revoked or expired — revoked via provider API, local file deletion.",
      "System and application logs: 90 days — automated log rotation and deletion.",
      "Database backups: 7 days rolling — automated overwrite by backup rotation.",
      "Temporary processing files: 24 hours — automated cleanup.",
    ],
  },
  {
    heading: "4. Data Disposal Procedures",
    items: [
      "Database records are deleted via standard ORM deletion, followed by storage reclamation.",
      "Files on disk are deleted using standard OS file removal. Encrypted volumes ensure deleted data is not recoverable without encryption keys.",
      "API tokens are revoked via the provider's API endpoint before local deletion.",
      "Backups are automatically overwritten by the rolling backup schedule. Manual deletion is performed when data must be removed before rotation.",
    ],
  },
  {
    heading: "5. Third-Party Data",
    items: [
      "When a third-party integration (e.g., Plaid) is discontinued, all locally stored data from that provider is deleted within 30 days.",
      "Provider-side data deletion is requested per the provider's data deletion process.",
    ],
  },
  {
    heading: "6. Hardware Disposal",
    items: [
      "Storage media being decommissioned is securely wiped using full-disk overwrite before disposal or repurposing.",
      "For encrypted drives, encryption keys are destroyed, rendering data unrecoverable.",
    ],
  },
  {
    heading: "7. Consumer Data Rights",
    items: [
      "Upon request, the Company will delete any consumer-related data within 30 days, subject to legal retention requirements.",
      "Data subject requests can be submitted to jared@yourkchomes.com.",
      "Note: The Company currently processes only its own business financial data. No consumer financial data is collected from third parties.",
    ],
  },
  {
    heading: "8. Legal Hold",
    items: [
      "If data is subject to a legal hold, litigation, or regulatory investigation, the applicable retention period is suspended and the data is preserved until the hold is released.",
    ],
  },
  {
    heading: "9. Compliance",
    items: [
      "IRS requirements (26 USC §6501) — 7-year retention for financial and tax records.",
      "Missouri data protection laws — timely disposal of personal information no longer needed.",
      "Plaid Developer Policy — data minimization and deletion upon integration termination.",
      "Stripe Terms of Service — payment data handling requirements.",
    ],
  },
  {
    heading: "10. Policy Review",
    items: [
      "This policy is reviewed annually or upon significant changes to data processing activities, whichever comes first.",
    ],
  },
];

function Section({ heading, items }: Section) {
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

export default function DataRetentionPage() {
  return (
    <LegalPageShell
      title="Data Retention & Disposal Policy"
      subtitle="This policy describes how Your KC Homes LLC retains, archives, and securely disposes of data in compliance with applicable laws and best practices."
    >
      <section className="grid gap-3 rounded-2xl border border-white/14 bg-white/[0.03] p-4 text-sm text-white/84 sm:grid-cols-2 sm:text-[0.94rem]">
        <p>
          <span className="font-semibold text-white/94">Organization: </span>
          Your KC Homes LLC
        </p>
        <p>
          <span className="font-semibold text-white/94">Effective Date: </span>
          January 1, 2025
        </p>
        <p>
          <span className="font-semibold text-white/94">Last Reviewed: </span>
          March 20, 2026
        </p>
        <p>
          <span className="font-semibold text-white/94">Contact: </span>
          <a
            className="underline decoration-white/35 underline-offset-4"
            href="mailto:jared@yourkchomes.com"
          >
            jared@yourkchomes.com
          </a>
        </p>
      </section>

      {SECTIONS.map((section) => (
        <Section key={section.heading} heading={section.heading} items={section.items} />
      ))}

      <section className="space-y-3 border-t border-white/14 pt-5">
        <h2 className="text-lg font-semibold text-white/94 sm:text-xl">11. Contact</h2>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          {LEGAL_BRAND}
          <br />
          Email: jared@yourkchomes.com
          <br />
          Website: https://tolley.io
        </p>
      </section>
    </LegalPageShell>
  );
}
