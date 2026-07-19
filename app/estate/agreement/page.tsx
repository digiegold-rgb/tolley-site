import type { Metadata } from "next";
import Link from "next/link";
import { ES_PHONE, ES_PHONE_TEL } from "@/lib/estate";
import {
  AGREEMENT_VERSION,
  AGREEMENT_FIELDS,
  AGREEMENT_CLAUSES,
  AGREEMENT_SIGNATURES,
} from "@/lib/estate-agreement";
import { PrintAgreementButton } from "@/components/estate/print-agreement-button";

export const metadata: Metadata = {
  title: "Client Agreement | Tolley Estate Sales",
  description:
    "The Tolley Estate Sales client agreement, published in plain English — plus the actual fill-in-the-blank contract you can read, download, and print before anyone visits.",
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

function BlankLine({ wide }: { wide?: boolean }) {
  return (
    <span
      className={`inline-block border-b border-neutral-400 align-baseline ${
        wide ? "w-full" : "min-w-[12rem] flex-1"
      }`}
    >
      &nbsp;
    </span>
  );
}

export default function EstateAgreementPage() {
  return (
    <main className="relative z-10 min-h-screen px-5 pb-20 sm:px-8 print:p-0">
      <div className="mx-auto max-w-2xl print:max-w-none">
        <nav className="pt-6 text-xs print:hidden" style={{ color: "var(--es-cream-dim)" }}>
          <Link href="/estate" className="hover:underline">
            ← Tolley Estate Sales
          </Link>
        </nav>

        <header className="mt-10 text-center print:hidden">
          <p className="es-kicker justify-center">Published in plain English</p>
          <h1 className="es-display mt-4 text-3xl font-semibold sm:text-4xl">
            The Client Agreement
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm" style={{ color: "var(--es-cream-dim)" }}>
            Most estate sale companies make you ask. We publish ours — because
            you shouldn&apos;t have to sign something you couldn&apos;t read
            first. The plain-English version is below, and under it the actual
            contract: when you&apos;re ready, we just fill in the blanks
            together.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#contract" className="es-btn-primary px-6 py-3 text-sm">
              Read the actual contract
            </a>
            <PrintAgreementButton />
          </div>
        </header>

        <div className="mt-10 space-y-4 print:hidden">
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

        {/* The actual contract — paper-styled on screen, the print target */}
        <section id="contract" className="mt-14 scroll-mt-24 print:mt-0">
          <div className="mb-4 text-center print:hidden">
            <p className="es-kicker justify-center">The actual contract</p>
            <p className="mx-auto mt-3 max-w-lg text-sm" style={{ color: "var(--es-cream-dim)" }}>
              This is the document we sign at your kitchen table. Read it now,
              download it, show it to whoever you trust — the blanks are the
              only thing that changes.
            </p>
          </div>

          <div className="rounded bg-white p-8 text-neutral-900 shadow-lg sm:p-12 print:rounded-none print:p-0 print:shadow-none">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-wide">
                ESTATE SALE SERVICES AGREEMENT
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Tolley Estate Sales · operated by Your KC Homes LLC · Independence, Missouri ·{" "}
                {ES_PHONE}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Version {AGREEMENT_VERSION} — published at tolley.io/estate/agreement
              </p>
            </div>

            {/* Fill-in header block */}
            <div className="mt-8 space-y-4 text-sm">
              {AGREEMENT_FIELDS.map((f) => (
                <div key={f.label} className="flex flex-wrap items-baseline gap-x-2 break-inside-avoid">
                  <span className="font-semibold">{f.label}:</span>
                  <BlankLine wide={f.wide} />
                  {f.hint && (
                    <span className="w-full text-xs italic text-neutral-500">{f.hint}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Clauses */}
            <ol className="mt-8 space-y-5 text-sm leading-relaxed">
              {AGREEMENT_CLAUSES.map((c, i) => (
                <li key={c.title} className="break-inside-avoid">
                  <p>
                    <span className="font-bold">
                      {i + 1}. {c.title}.
                    </span>{" "}
                    {c.body}
                  </p>
                  {c.options && (
                    <ul className="mt-3 space-y-2 pl-1">
                      {c.options.map((opt) => (
                        <li key={opt} className="flex items-start gap-3">
                          <span className="mt-0.5 inline-block h-4 w-4 shrink-0 border border-neutral-500" />
                          <span>{opt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>

            {/* Appendix A */}
            <div className="mt-8 break-inside-avoid text-sm">
              <p className="font-bold">Appendix A — Reserved items (minimum prices)</p>
              <div className="mt-3 space-y-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-baseline gap-2">
                    <span className="text-neutral-500">{n}.</span>
                    <BlankLine wide />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs italic text-neutral-500">
                attach a second sheet if needed — reserves must be listed before staging begins
              </p>
            </div>

            {/* Signatures */}
            <div className="mt-10 grid gap-8 break-inside-avoid sm:grid-cols-2">
              {AGREEMENT_SIGNATURES.map((s) => (
                <div key={s.label} className="text-sm">
                  <div className="border-b border-neutral-500 pb-8">&nbsp;</div>
                  <p className="mt-2 font-semibold">{s.label}</p>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-neutral-600">Date:</span>
                    <BlankLine />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-[10px] text-neutral-400">
              Tolley Estate Sales · Your KC Homes LLC · Independence, MO · tolley.io/estate ·{" "}
              {ES_PHONE}
            </p>
          </div>

          <div className="mt-6 text-center print:hidden">
            <PrintAgreementButton />
          </div>
        </section>

        <div className="es-sale-plate mt-12 p-8 text-center print:hidden">
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

        <p className="mt-8 text-center text-xs print:hidden" style={{ color: "rgba(243,234,217,0.35)" }}>
          This page publishes our standard terms for transparency; the signed
          agreement is the binding document. Tolley Estate Sales is operated by
          Your KC Homes LLC, Independence, MO.
        </p>
      </div>
    </main>
  );
}
