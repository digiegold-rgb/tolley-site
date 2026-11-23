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
              A network that works for your home. And your business.
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
            <p className="tc-kicker text-center">Network consulting & setup</p>
            <h2 id="tn-offers" className="tc-display mt-2 mb-8 text-center text-3xl text-white">
              Plan it. Connect it. Make it work.
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {TN_OFFERS.map((offer) => (
                <article key={offer.title} className="tc-card p-6">
                  <h3 className="tc-display text-lg text-[#ff7a1a]">{offer.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-white/70">{offer.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="tn-assessment" className="tc-card p-6 sm:p-10">
            <p className="tc-kicker">Start with a plan</p>
            <h2 id="tn-assessment" className="tc-display mt-2 text-3xl text-white">Know what to fix, what to keep, and what comes next.</h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">Moving into an office? Losing video calls in the back room? Sharing files between computers? Bring the problem or the idea. We can scope a useful assessment before you buy equipment.</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <div><h3 className="text-lg font-semibold text-white">Review the setup</h3><p className="mt-2 text-base text-white/70">Your space, internet service, devices, coverage, and the work the network needs to support.</p></div>
              <div><h3 className="text-lg font-semibold text-white">Get a practical plan</h3><p className="mt-2 text-base text-white/70">An agreed assessment can include a network layout, priorities, equipment recommendations, and installation options.</p></div>
              <div><h3 className="text-lg font-semibold text-white">Agree the work</h3><p className="mt-2 text-base text-white/70">Confirm hardware, labor, scheduling, testing, and handoff before installation. Plan any downtime around your work.</p></div>
            </div>
            <a href="#consult" className="tc-btn-secondary mt-6 inline-flex min-h-11 items-center rounded px-6 py-3 font-semibold">Discuss my network</a>
          </section>

          <section aria-labelledby="tn-jared" className="grid items-center gap-8 sm:grid-cols-[1fr_2fr]">
            <div><p className="tc-kicker">Work directly with Jared</p><h2 id="tn-jared" className="tc-display mt-2 text-3xl text-white">Practical help from planning to handoff.</h2></div>
            <div className="space-y-4 text-base leading-relaxed text-white/70">
              <p>Jared spent five years as an Apple Genius, repairing computers and helping people use their technology. He also built the computers for his own mining company.</p>
              <p>Tell him how you use your space and what is getting in the way. Together, you can agree the network work, budget, and next steps.</p>
              <Link href="/pc" className="inline-flex min-h-11 items-center font-semibold text-[#ff7a1a] underline underline-offset-4">Need a workstation too? Explore Tolley PC</Link>
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
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/70">The phone conversation is free. On-site assessments, equipment, installation, and follow-up support are scoped and priced before you commit.</p>
            {PRICING_PLACEHOLDER}
          </section>

          <section id="consult" className="scroll-mt-24">
            <div className="mx-auto max-w-2xl">
              <p className="tc-kicker text-center">Free consult</p>
              <h2 className="tc-display mt-2 mb-3 text-center text-3xl text-white">
                Tell Jared about the network
              </h2>
              <p className="mb-8 text-center text-sm text-white/50">
                Share what you need and a phone number or email. Jared will follow up to discuss the scope, coverage, and timing.
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
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 px-5 py-4 text-base font-semibold text-white/80 transition-colors hover:text-white">
                    {faq.q}
                    <span className="text-xl text-[#ff7a1a] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-5 pb-4 text-base leading-relaxed text-white/70">{faq.a}</div>
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
