import type { Metadata } from "next";
import Link from "next/link";

import { ES_PHONE, ES_PHONE_TEL } from "@/lib/estate";
import {
  ES_LEGAL_ADDRESS,
  ES_LEGAL_EFFECTIVE_DATE,
  ES_LEGAL_EMAIL,
  ES_LEGAL_ENTITY,
  ES_LEGAL_LAST_UPDATED,
} from "@/lib/legal-estate";

export const metadata: Metadata = {
  title: "Privacy Policy | Tolley Estate Sales",
  description:
    "How Tolley Estate Sales collects, uses, and protects information from client families and estate sale shoppers.",
  alternates: { canonical: "https://www.tolley.io/estate/privacy" },
};

type Section = {
  heading: string;
  intro?: string;
  items?: string[];
};

const SECTIONS: Section[] = [
  {
    heading: "1. Who we are",
    intro: `${ES_LEGAL_ENTITY}, ${ES_LEGAL_ADDRESS}. We conduct in-home estate sales across the Kansas City metro. This policy covers tolley.io/estate and everything we do in the course of running a sale.`,
  },
  {
    heading: "2. Information we collect from client families",
    items: [
      "Your name, phone number, email address, and the address of the property where the sale will be held.",
      "The name of the property owner or estate of record, which the client agreement requires us to name.",
      "Photographs of the personal property being sold, taken by us during staging.",
      "Sale records: item pricing, gross proceeds, and the itemized settlement we provide you.",
    ],
  },
  {
    heading: "3. Information we collect from shoppers",
    items: [
      "Email address or phone number, if you join our early-access list at a sale or on this site.",
      "Standard web analytics when you visit tolley.io: pages viewed, referring site, approximate location, device and browser details, and timestamps.",
      "Payment card information is handled entirely by our payment processors. We never see or store full card numbers.",
    ],
  },
  {
    heading: "4. How we protect a sale address",
    intro:
      "This is the part families care about most, so we state it plainly. The exact address of a sale is treated as confidential until the moment we publish it, and it comes back down everywhere once the sale is over.",
    items: [
      "We publish only a neighborhood label until the agreed release time.",
      "Every photograph we publish has its location metadata stripped before it leaves our systems, and we do not publish exterior shots, house numbers, or street signs.",
      "After the sale, the address is removed from our site, our listings on third-party platforms, and our social posts.",
    ],
  },
  {
    heading: "5. How we use information",
    items: [
      "To run your sale: staging, pricing, advertising, staffing, and settlement.",
      "To advertise a sale on platforms shoppers use, including EstateSales.NET, Facebook, Craigslist, Nextdoor, and gsalr.",
      "To send our early-access list exactly two emails per sale — an announcement, and the address the night before. Nothing else is ever sent to that list.",
      "To respond to inquiries and provide customer support.",
      "To meet legal, tax, and recordkeeping obligations.",
    ],
  },
  {
    heading: "6. What we do not do",
    items: [
      "We do not sell, rent, or trade your personal information to anyone, for any purpose.",
      "We do not send marketing blasts to our shopper list. Two emails per sale is the entire program.",
      "We do not publish photographs of a family's home interior after a sale without the family's agreement.",
    ],
  },
  {
    heading: "7. Who we share information with",
    items: [
      "Advertising platforms, when we publish a sale listing — this is the sale information you have asked us to advertise, not your personal contact details.",
      "Payment processors, to accept cards at the sale.",
      "Service providers who host our website and send our email.",
      "Government or legal authorities, where required by law.",
    ],
  },
  {
    heading: "8. Your choices",
    items: [
      "Every email we send has a one-click unsubscribe. Using it removes you immediately and permanently.",
      "You can ask us what information we hold about you, and ask us to correct or delete it, by emailing us.",
      "Client families can request removal of any sale photograph at any time, before or after a sale.",
    ],
  },
  {
    heading: "9. Retention",
    intro:
      "We keep sale records and settlement statements for as long as tax and business recordkeeping law requires. Shopper list entries are kept until you unsubscribe. Sale photographs are kept for our portfolio unless the family asks us to remove them.",
  },
  {
    heading: "10. Children",
    intro:
      "Our services are directed to adults. We do not knowingly collect information from anyone under 18.",
  },
  {
    heading: "11. Changes to this policy",
    intro:
      "If we change this policy we will update the date below. Material changes affecting client families will also be communicated directly.",
  },
  {
    heading: "12. Contact us",
    intro: `Email ${ES_LEGAL_EMAIL} or call ${ES_PHONE}. We are a two-person company and you will reach an owner.`,
  },
];

export default function EstatePrivacyPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 pb-20 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <nav className="pt-6 text-xs" style={{ color: "var(--es-cream-dim)" }}>
          <Link href="/estate" className="hover:underline">
            ← Tolley Estate Sales
          </Link>
        </nav>

        <header className="mt-10 text-center">
          <p className="es-kicker justify-center">Privacy</p>
          <h1 className="es-display mt-4 text-3xl font-semibold sm:text-4xl">Privacy Policy</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm" style={{ color: "var(--es-cream-dim)" }}>
            {ES_LEGAL_ENTITY} · {ES_LEGAL_ADDRESS}
            <br />
            Effective {ES_LEGAL_EFFECTIVE_DATE} · Last updated {ES_LEGAL_LAST_UPDATED}
          </p>
        </header>

        <div className="mt-10 space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.heading} className="es-panel p-6">
              <h2 className="es-display text-lg" style={{ color: "var(--es-brass-bright)" }}>
                {s.heading}
              </h2>
              {s.intro ? (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--es-cream-dim)" }}>
                  {s.intro}
                </p>
              ) : null}
              {s.items ? (
                <ul className="mt-3 space-y-2">
                  {s.items.map((item) => (
                    <li
                      key={item}
                      className="pl-4 text-sm leading-relaxed"
                      style={{ color: "var(--es-cream-dim)", textIndent: "-1rem" }}
                    >
                      · {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="es-sale-plate mt-12 p-8 text-center">
          <p className="text-sm" style={{ color: "var(--es-cream-dim)" }}>
            Questions about any of this? Call or text an owner directly.
          </p>
          <a href={ES_PHONE_TEL} className="es-btn-primary mt-4 inline-block px-6 py-3 text-sm">
            {ES_PHONE}
          </a>
          <p className="mt-4 text-xs">
            <Link href="/estate/terms" className="hover:underline" style={{ color: "var(--es-cream-dim)" }}>
              Terms of Service
            </Link>
            {" · "}
            <Link
              href="/estate/agreement"
              className="hover:underline"
              style={{ color: "var(--es-cream-dim)" }}
            >
              Client Agreement
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
