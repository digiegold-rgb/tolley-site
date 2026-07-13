import type { Metadata } from "next";
import Link from "next/link";
import { ES_PHONE, ES_PHONE_TEL } from "@/lib/estate";

export const metadata: Metadata = {
  title: "Client Agreement | Tolley Estate Sales",
  description:
    "The Tolley Estate Sales client agreement, published in plain English. Read every term before you sign — commission, unsold items, settlement timing, all of it.",
  alternates: { canonical: "https://www.tolley.io/estate/agreement" },
};

/**
 * Client-facing agreement summary. Section copy mirrors the signed contract;
 * when Jared supplies the executed contract text, keep these sections in sync
 * with it (this page is marketing transparency, not the signature copy).
 */
const SECTIONS = [
  {
    title: "What we do",
    body: "Tolley Estate Sales (operated by Your KC Homes LLC) acts as your agent to stage, research, price, advertise, staff, and conduct an estate sale of the personal property you designate at the sale address. The sale is conducted in the name of and on behalf of the property owner or their estate.",
  },
  {
    title: "What it costs",
    body: "Nothing up front. We are paid a commission — an agreed percentage of gross sale proceeds, written into your agreement before we begin. The commission covers staging, pricing research, photography, advertising, staffing, and payment processing. Any add-on services (haul-away, cleanout, dumpster) are itemized separately and agreed in writing before they happen.",
  },
  {
    title: "Who prices things",
    body: "We do — against real sold comparables, not guesses. If specific items matter to you, we'll agree minimum prices (reserves) for them in writing before the sale. We may group low-value items into lots to sell the home down efficiently.",
  },
  {
    title: "Once we start, the inventory stays",
    body: "After the agreement is signed and staging begins, items can't be removed from the sale by the family (the industry calls this the no-cherry-picking clause). Removed items unbalance the sale we've priced and advertised. Take everything the family wants to keep before we begin — we'll walk it with you.",
  },
  {
    title: "What happens to unsold items",
    body: "Your choice, decided up front in the agreement: (a) returned to you, (b) donated with receipts collected for your taxes, (c) hauled away for an agreed fee, or (d) consigned into our resale channels — we keep selling them for you online and you receive the agreed share as they sell.",
  },
  {
    title: "When you get paid",
    body: "You receive an itemized settlement statement and payment within the number of business days written in your agreement — days, not weeks. Every item category is accounted for on the statement.",
  },
  {
    title: "Taxes",
    body: "Estate sales of household goods conducted on behalf of the owner are treated as the owner's liquidation of personal property under Missouri law (RSMo 144.010). The agreement names the property owner for that reason. Nothing on this page is tax advice — talk to your tax professional about your specific situation.",
  },
  {
    title: "Access, utilities & safety",
    body: "You provide reasonable access to the property for staging days and sale days, with electricity and water on. We carry out the sale with reasonable care for the home; sale-day foot traffic is managed with staffed entrances and occupancy limits.",
  },
  {
    title: "Cancellation",
    body: "Either side can cancel in writing before staging begins at no cost. After staging and advertising have started, a cancellation fee covering documented work performed applies, as set out in the agreement.",
  },
] as const;

export default function EstateAgreementPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 pb-20 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <nav className="pt-6 text-xs" style={{ color: "var(--es-cream-dim)" }}>
          <Link href="/estate" className="hover:underline">
            ← Tolley Estate Sales
          </Link>
        </nav>

        <header className="mt-10 text-center">
          <p className="es-kicker justify-center">Published in plain English</p>
          <h1 className="es-display mt-4 text-3xl font-semibold sm:text-4xl">
            The Client Agreement
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm" style={{ color: "var(--es-cream-dim)" }}>
            Most estate sale companies make you ask. We publish ours — because
            you shouldn&apos;t have to sign something you couldn&apos;t read
            first. This is the plain-English version of every term in the
            contract you&apos;d sign.
          </p>
        </header>

        <div className="mt-10 space-y-4">
          {SECTIONS.map((s, i) => (
            <section key={s.title} className="es-panel p-6">
              <h2 className="es-display text-lg" style={{ color: "var(--es-brass-bright)" }}>
                {i + 1}. {s.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--es-cream-dim)" }}>
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <div className="es-sale-plate mt-10 p-8 text-center">
          <p className="es-display relative z-10 text-xl">
            Ready to walk the house?
          </p>
          <p className="relative z-10 mt-2 text-sm" style={{ color: "var(--es-cream-dim)" }}>
            The walkthrough is free and everything above is negotiable — every
            home is different.
          </p>
          <div className="relative z-10 mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/estate#walkthrough" className="es-btn-primary px-7 py-3 text-sm">
              Book a free walkthrough
            </Link>
            <a href={ES_PHONE_TEL} className="es-btn-secondary px-7 py-3 text-sm">
              Call {ES_PHONE}
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: "rgba(243,234,217,0.35)" }}>
          This page summarizes standard terms for transparency; the signed
          agreement is the binding document. Tolley Estate Sales is operated by
          Your KC Homes LLC, Independence, MO.
        </p>
      </div>
    </main>
  );
}
