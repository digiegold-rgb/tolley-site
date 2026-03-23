import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import {
  LEGAL_BRAND,
  LEGAL_SUPPORT_EMAIL,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Information Security Policy | T-Agent",
  description:
    "Information Security Policy for Your KC Homes LLC, covering access control, encryption, network security, incident response, and third-party integrations.",
};

type Section = {
  heading: string;
  items: string[];
};

const SECTIONS: Section[] = [
  {
    heading: "1. Purpose",
    items: [
      "This policy establishes the information security framework for Your KC Homes LLC to protect business data, customer information, and integrated third-party services from unauthorized access, disclosure, or loss.",
    ],
  },
  {
    heading: "2. Scope",
    items: [
      "This policy applies to all systems, applications, and data managed by the Company, including business financial data and bank account integrations, customer and client records, internal infrastructure and servers, and third-party API integrations (Plaid, Stripe, etc.).",
    ],
  },
  {
    heading: "3. Access Control",
    items: [
      "All production systems require authenticated access via SSH key or VPN (Tailscale).",
      "Network segmentation is enforced via VLANs separating production, IoT, and guest traffic.",
      "Administrative access is limited to the business owner.",
      "Third-party API credentials are stored in environment variables on the server, never committed to source code or version control.",
      "API keys and tokens are rotated periodically and upon any suspected compromise.",
    ],
  },
  {
    heading: "4. Encryption",
    items: [
      "In transit: All external communications use TLS 1.2 or higher. Encrypted tunnels provide secure remote access.",
      "At rest: Sensitive configuration files and credentials are stored on encrypted volumes.",
    ],
  },
  {
    heading: "5. Data Classification",
    items: [
      "Confidential: API keys, bank credentials, customer PII — encrypted storage, access-controlled, no sharing.",
      "Internal: Financial reports, transaction data — private infrastructure only, not publicly accessible.",
      "Public: Marketing content, website pages — no restrictions.",
    ],
  },
  {
    heading: "6. Network Security",
    items: [
      "Firewall with stateful packet inspection protects all network boundaries.",
      "Production, management, IoT, and guest networks operate on separate VLANs.",
      "Remote access is restricted to encrypted mesh VPN — no open ports exposed to the public internet.",
      "Automated health checks and alerting monitor all services continuously.",
    ],
  },
  {
    heading: "7. Third-Party Integration Security",
    items: [
      "OAuth tokens and API keys are stored server-side in environment variables with no client-side exposure.",
      "Webhook endpoints validate request signatures (HMAC) where supported by the provider.",
      "Data received from third parties (Plaid, Stripe) is stored on private infrastructure and not shared externally.",
      "Consumer financial data is never resold, shared with, or disclosed to any third party for marketing purposes.",
    ],
  },
  {
    heading: "8. Incident Response",
    items: [
      "Detection: Automated monitoring of service health, API errors, and unusual activity with log aggregation.",
      "Containment: Compromised credentials are revoked immediately and affected systems are isolated.",
      "Eradication: Threats are removed and vulnerabilities are patched.",
      "Recovery: Systems are restored from backups if needed and integrity is verified.",
      "Notification: Affected third-party providers are notified within 72 hours of a confirmed breach. Affected individuals are notified per applicable law.",
    ],
  },
  {
    heading: "9. Backup and Recovery",
    items: [
      "Daily automated backups of all critical data to secondary encrypted storage.",
      "7-day rolling retention with automated rotation.",
      "Recovery testing performed periodically to verify backup integrity.",
    ],
  },
  {
    heading: "10. Personnel Security",
    items: [
      "The Company is owner-operated. No employees or contractors currently have access to production systems.",
      "If contractors are engaged, access will be provisioned on a least-privilege basis and revoked upon completion of work.",
    ],
  },
  {
    heading: "11. Compliance",
    items: [
      "Financial data handling complies with IRS record retention requirements.",
      "Payment processing complies with PCI-DSS via Stripe — card numbers are never directly handled.",
      "Bank data access via Plaid complies with Plaid's data security requirements and end-user privacy policy.",
    ],
  },
  {
    heading: "12. Policy Review",
    items: [
      "This policy is reviewed annually or upon significant infrastructure changes, whichever comes first.",
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

export default function SecurityPage() {
  return (
    <LegalPageShell
      title="Information Security Policy"
      subtitle="This policy describes the security controls, practices, and procedures that protect data and systems operated by Your KC Homes LLC."
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
          <span className="font-semibold text-white/94">Security Contact: </span>
          <a
            className="underline decoration-white/35 underline-offset-4"
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
          >
            jared@yourkchomes.com
          </a>
        </p>
      </section>

      {SECTIONS.map((section) => (
        <Section key={section.heading} heading={section.heading} items={section.items} />
      ))}

      <section className="space-y-3 border-t border-white/14 pt-5">
        <h2 className="text-lg font-semibold text-white/94 sm:text-xl">13. Contact</h2>
        <p className="text-sm leading-6 text-white/83 sm:text-[0.95rem]">
          {LEGAL_BRAND}
          <br />
          Security Contact: jared@yourkchomes.com
          <br />
          Website: https://tolley.io
        </p>
      </section>
    </LegalPageShell>
  );
}
