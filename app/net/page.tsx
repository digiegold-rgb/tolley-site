import Link from "next/link";
import { PublicOfferDetails } from "@/components/shared/public-offer-details";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { NetQuoteForm } from "@/components/net/quote-form";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  NET_PRICE_LINES,
  PRICING_PLACEHOLDER,
  TN_AREA,
  TN_FAQ,
  TN_OFFERS,
  TN_PHONE,
  TN_PHONE_SMS,
  TN_PHONE_TEL,
  TN_PROOF_MEASURED,
  TN_PROOF_NOTES,
  TN_PROOF_STATS,
  TN_PURPOSE,
  netJsonLd,
  netPriceLines,
} from "@/lib/net";

export default function NetPage() {
  const prices = netPriceLines();
  return (
    <>
      <main className="relative z-10">
        <div className="sticky top-0 z-50">
          <div className="tc-hazard h-1.5" aria-hidden="true" />
          <div className="tc-strip flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center">
            <span className="tc-display text-sm font-semibold text-white">Free consult</span>
            <span className="text-white/30">|</span>
            <a
              href={TN_PHONE_TEL}
              className="text-sm font-bold text-[#ff7a1a] underline decoration-[#ff7a1a]/40 underline-offset-2 hover:decoration-[#ff7a1a]"
            >
              {TN_PHONE}
            </a>
            <span className="text-white/30">|</span>
            <a href={TN_PHONE_SMS} className="min-h-11 text-xs text-white/70 hover:text-white sm:min-h-0">
              Text Jared
            </a>
          </div>
        </div>

        <section className="relative overflow-hidden px-5 pt-10 pb-10 text-center sm:pt-16 sm:pb-14">
          <div className="mx-auto max-w-3xl">
            <p className="tc-kicker">Tolley Net · {TN_AREA}</p>
            <h1 className="tc-display mt-4 text-3xl font-bold leading-tight text-white sm:text-5xl">
              Kansas City home and gaming network setup: lower ping, Wi-Fi that reaches every room, installed by Jared.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              {TN_PURPOSE}
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
              <a href={TN_PHONE_TEL} className="tc-btn-primary min-h-11 rounded px-8 py-4 text-lg font-bold">
                Call {TN_PHONE}
              </a>
              <a href="#consult" className="tc-btn-secondary min-h-11 rounded px-8 py-4 text-lg font-bold">
                Request a consult
              </a>
            </div>
            <ul className="mt-6 flex flex-col items-center gap-1 text-sm text-white/70">
              {prices.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-16 px-5 pb-20 sm:px-8">
          <section aria-labelledby="tn-offers">
            <p className="tc-kicker text-center">What Jared installs</p>
            <h2 id="tn-offers" className="tc-display mt-2 mb-8 text-center text-3xl text-white">
              Offers
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {TN_OFFERS.map((offer) => (
                <article key={offer.title} className="tc-card p-6">
                  <h3 className="tc-display text-lg text-[#ff7a1a]">{offer.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{offer.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="tn-pricing" className="tc-card p-6 text-center sm:p-10">
            <p className="tc-kicker">Pricing</p>
            <h2 id="tn-pricing" className="tc-display mt-2 text-3xl text-white">
              Free consult. Custom quote after consult.
            </h2>
            <ul className="mt-6 space-y-2 text-lg text-white/80">
              {NET_PRICE_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {PRICING_PLACEHOLDER}
          </section>

          <section aria-labelledby="tn-proof">
            <p className="tc-kicker text-center">From Jared&apos;s own network</p>
            <h2 id="tn-proof" className="tc-display mt-2 mb-3 text-center text-3xl text-white">
              Measured {TN_PROOF_MEASURED}
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-white/55">
              Fiber in passthrough to UniFi, on Jared&apos;s home network. These are that install&apos;s results, not a guarantee for every house.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TN_PROOF_STATS.map((stat) => (
                <div key={stat.label} className="tc-card p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{stat.label}</p>
                  <p className="tc-display mt-2 text-xl text-white sm:text-2xl">{stat.value}</p>
                </div>
              ))}
            </div>
            <ul className="mx-auto mt-6 max-w-2xl space-y-3 text-sm leading-relaxed text-white/65">
              {TN_PROOF_NOTES.map((note) => (
                <li key={note} className="tc-card px-5 py-4">{note}</li>
              ))}
            </ul>
          </section>

          <section id="consult" className="scroll-mt-24">
            <div className="mx-auto max-w-2xl">
              <p className="tc-kicker text-center">Free consult</p>
              <h2 className="tc-display mt-2 mb-3 text-center text-3xl text-white">
                Tell Jared about the network
              </h2>
              <p className="mb-8 text-center text-sm text-white/50">
                He&apos;ll call or text you back. The request is confirmed only after it is saved.
              </p>
              <NetQuoteForm />
            </div>
          </section>

          <section aria-labelledby="tn-faq">
            <p className="tc-kicker text-center">Good questions</p>
            <h2 id="tn-faq" className="tc-display mt-2 mb-8 text-center text-3xl text-white">FAQ</h2>
            <div className="mx-auto max-w-2xl space-y-3">
              {TN_FAQ.map((faq) => (
                <details key={faq.q} className="tc-form group overflow-hidden">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-white/80 transition-colors hover:text-white">
                    {faq.q}
                    <span className="text-xl text-[#ff7a1a] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-5 pb-4 text-sm leading-relaxed text-white/55">{faq.a}</div>
                </details>
              ))}
            </div>
          </section>
        </div>

        <footer className="border-t border-white/5 px-5 py-8 text-center">
          <div className="tc-hazard mx-auto mb-6 h-1 max-w-xs" aria-hidden="true" />
          <p className="text-sm text-white/30">
            &copy; {new Date().getFullYear()} Tolley Net &middot; {TN_AREA} &middot;{" "}
            <a href={TN_PHONE_TEL} className="text-[#ff7a1a]/60 hover:text-[#ff7a1a]">
              {TN_PHONE}
            </a>
          </p>
          <p className="mt-1 text-xs text-white/20">
            Part of{" "}
            <a href="https://www.tolley.io/start" className="text-white/30 hover:text-white/50">
              tolley.io
            </a>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-white/20">
            <Link href="/services" className="hover:text-white/40">All services</Link>
            <Link href="/pc" className="hover:text-white/40">Custom PCs</Link>
            <Link href="/cleanouts" className="hover:text-white/40">Cleanouts</Link>
            <Link href="/privacy" className="hover:text-white/40">Privacy</Link>
            <Link href="/terms" className="hover:text-white/40">Terms</Link>
          </div>
        </footer>
        <MoreFromTolley currentSubsite="net" />
      </main>
      <PublicOfferDetails name="net" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(netJsonLd()) }} />
    </>
  );
}
