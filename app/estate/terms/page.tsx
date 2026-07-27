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
  title: "Terms of Service | Tolley Estate Sales",
  description:
    "Terms of Service for Tolley Estate Sales, operated by Your KC Homes LLC — website use, sale attendance, purchases, and the client agreement.",
  alternates: { canonical: "https://www.tolley.io/estate/terms" },
};

type Section = {
  heading: string;
  intro?: string;
  items?: string[];
};

const SECTIONS: Section[] = [
  {
    heading: "1. Who these terms cover",
    intro: `These terms govern your use of tolley.io/estate and your attendance at sales conducted by ${ES_LEGAL_ENTITY}, ${ES_LEGAL_ADDRESS}. If you hire us to conduct a sale, the signed client agreement governs that relationship — these terms do not replace it, and where the two conflict, the signed agreement wins.`,
  },
  {
    heading: "2. The client agreement is published",
    intro:
      "We publish our full fill-in-the-blank client agreement at tolley.io/estate/agreement, and you can download it as a PDF before anyone visits your home. Nothing becomes binding until you sign a copy with the blanks filled in.",
  },
  {
    heading: "3. Sale information is our best effort",
    items: [
      "Sale dates, hours, photographs, and item descriptions are published in good faith and can change — a family can cancel, weather can close a sale, and items sell before you arrive.",
      "A photograph on a sale page is not a guarantee that the item is still available.",
      "We do not guarantee that any specific item will be present, unsold, or priced at any particular amount.",
    ],
  },
  {
    heading: "4. Sale addresses",
    intro:
      "We publish a neighborhood first and release the exact address at the time stated on the sale page. Our early-access list receives it the night before. Please do not attempt to identify, visit, or contact a sale property before the published release time — families let us into their homes on the understanding that we protect their privacy.",
  },
  {
    heading: "5. Buying at a sale",
    items: [
      "All items are sold as-is, where-is, with no warranty of any kind, express or implied. Inspect before you buy.",
      "All sales are final. We do not offer refunds, returns, or exchanges.",
      "Payment is due at the time of purchase. We accept cash, all major cards, tap-to-pay, and approved payment apps.",
      "Purchases must be removed within the time stated at the sale. You are responsible for loading and transporting what you buy.",
      "Offers are welcome on any item and are presented to the owner, but we cannot accept an offer on the owner's behalf without their approval.",
    ],
  },
  {
    heading: "6. Conduct at a sale",
    items: [
      "Entry is managed for safety and may be limited by occupancy. We use numbered entry tickets when a line forms; there is no early entry.",
      "The property is a private home. Please treat it, the family, and the other shoppers accordingly.",
      "You enter and shop at your own risk. We are not responsible for personal injury or property damage except where caused by our own negligence and where liability cannot be excluded by law.",
      "We may decline entry or ask anyone to leave.",
    ],
  },
  {
    heading: "7. Our email list",
    intro:
      "Joining our early-access list means we will email you exactly twice per sale: an announcement, and the address the night before. We do not send marketing blasts, and we do not share the list. Every email has a one-click unsubscribe.",
  },
  {
    heading: "8. Website use",
    items: [
      "Content on this site — text, photographs, and design — belongs to us. Please do not republish it commercially without asking.",
      "Do not use automated tools to collect information from this site, and do not use it to harvest contact details.",
      "We may change or remove any part of the site at any time.",
    ],
  },
  {
    heading: "9. Third-party platforms",
    intro:
      "We advertise sales on EstateSales.NET, Facebook, Craigslist, Nextdoor, gsalr, and similar platforms. Those platforms have their own terms and privacy policies, which govern your use of them. We do not control what they do with your information.",
  },
  {
    heading: "10. Limitation of liability",
    intro:
      "To the fullest extent permitted by Missouri law, our total liability arising out of your use of this site or attendance at a sale is limited to the amount you paid us in the transaction giving rise to the claim. We are not liable for indirect or consequential damages.",
  },
  {
    heading: "11. Governing law",
    intro:
      "These terms are governed by the laws of the State of Missouri, and any dispute will be brought in the state or federal courts serving Jackson County, Missouri.",
  },
  {
    heading: "12. Changes",
    intro:
      "We may update these terms; the effective date below will change when we do. Continuing to use the site after an update means you accept the revised terms.",
  },
  {
    heading: "13. Contact us",
    intro: `Email ${ES_LEGAL_EMAIL} or call ${ES_PHONE}.`,
  },
];

export default function EstateTermsPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 pb-20 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <nav className="pt-6 text-xs" style={{ color: "var(--es-cream-dim)" }}>
          <Link href="/estate" className="hover:underline">
            ← Tolley Estate Sales
          </Link>
        </nav>

        <header className="mt-10 text-center">
          <p className="es-kicker justify-center">Terms</p>
          <h1 className="es-display mt-4 text-3xl font-semibold sm:text-4xl">Terms of Service</h1>
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
            Thinking about hiring us? Read the contract first — that&apos;s the point.
          </p>
          <Link href="/estate/agreement" className="es-btn-primary mt-4 inline-block px-6 py-3 text-sm">
            Read the Client Agreement
          </Link>
          <p className="mt-4 text-xs">
            <Link
              href="/estate/privacy"
              className="hover:underline"
              style={{ color: "var(--es-cream-dim)" }}
            >
              Privacy Policy
            </Link>
            {" · "}
            <a href={ES_PHONE_TEL} className="hover:underline" style={{ color: "var(--es-cream-dim)" }}>
              {ES_PHONE}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
