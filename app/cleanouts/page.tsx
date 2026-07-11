import {
  TC_PHONE,
  TC_PHONE_TEL,
  TC_PHONE_SMS,
  TC_AREA,
  TC_STEPS,
  TC_SERVICES,
  TC_FAQ,
} from "@/lib/cleanouts";
import { CleanoutQuoteForm } from "@/components/cleanouts/quote-form";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";

export default function CleanoutsPage() {
  return (
    <main className="relative z-10 min-h-screen">
      {/* Sticky call/text strip */}
      <div className="sticky top-0 z-50">
        <div className="tc-hazard h-1.5" aria-hidden="true" />
        <div className="tc-strip flex items-center justify-center gap-3 px-4 py-2.5 text-center">
          <span className="tc-display text-sm font-semibold text-white">Free Quotes</span>
          <span className="text-white/30">|</span>
          <a
            href={TC_PHONE_TEL}
            className="text-sm font-bold text-[#ff7a1a] underline decoration-[#ff7a1a]/40 underline-offset-2 hover:decoration-[#ff7a1a]"
          >
            {TC_PHONE}
          </a>
          <span className="text-white/30">|</span>
          <a href={TC_PHONE_SMS} className="text-xs text-white/70 hover:text-white">
            Call or Text
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-16 pb-20 text-center sm:pt-24 sm:pb-24">
        <div className="mx-auto max-w-3xl">
          <p className="tc-kicker">Tolley Cleanouts · {TC_AREA}</p>
          <h1 className="tc-display mt-4 text-4xl font-bold text-white sm:text-6xl">
            Estate &amp; rental cleanouts,{" "}
            <span className="text-[#ff7a1a]">done in one call.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/60 sm:text-xl">
            We clear the unit, broom-clean it, and haul everything — and anything
            with resale value comes off your bill.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href={TC_PHONE_TEL} className="tc-btn-primary rounded px-8 py-4 text-lg font-bold">
              Call {TC_PHONE}
            </a>
            <a href={TC_PHONE_SMS} className="tc-btn-secondary rounded px-8 py-4 text-lg font-bold">
              Text Photos for a Quote
            </a>
          </div>

          <p className="mx-auto mt-6 max-w-md text-sm text-white/40">
            Free quotes, no public price list games — one flat number for the whole
            job, <span className="font-semibold text-[#ff7a1a]">before</span> we start.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-5 pb-20 sm:px-8">
        {/* How it works */}
        <section className="tc-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <p className="tc-kicker text-center">How it works</p>
          <h2 className="tc-display mt-2 mb-8 text-center text-3xl text-white">
            Three steps. One visit.
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {TC_STEPS.map((step) => (
              <div key={step.num} className="tc-card p-6">
                <div className="tc-step-num">{step.num}</div>
                <h3 className="tc-display mt-4 text-lg text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-white/50">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Services */}
        <section className="tc-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <p className="tc-kicker text-center">What we clear</p>
          <h2 className="tc-display mt-2 mb-8 text-center text-3xl text-white">Services</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TC_SERVICES.map((svc) => (
              <div key={svc.title} className="tc-card p-6">
                <h3 className="tc-display text-lg text-[#ff7a1a]">{svc.title}</h3>
                <p className="mt-2 text-sm text-white/50">{svc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* "Paid twice" differentiator */}
        <section className="tc-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <div className="tc-diff p-8 text-center sm:p-12">
            <p className="tc-kicker">The Tolley difference</p>
            <h2 className="tc-display mt-3 text-3xl text-white sm:text-4xl">
              Items with resale value reduce your bill
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              Most haulers charge you to take stuff, then sell the good pieces and
              keep the money. We do it in the open:{" "}
              <span className="font-semibold text-[#ff7a1a]">we resell, you save</span>{" "}
              — the resale value of furniture, appliances, and tools comes straight
              off your quote.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="tc-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <p className="tc-kicker text-center">Good questions</p>
          <h2 className="tc-display mt-2 mb-8 text-center text-3xl text-white">FAQ</h2>
          <div className="mx-auto max-w-2xl space-y-3">
            {TC_FAQ.map((faq) => (
              <details key={faq.q} className="tc-form group overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-white/80 transition-colors hover:text-white">
                  {faq.q}
                  <span className="text-xl text-[#ff7a1a] transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-white/50">{faq.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Quote form */}
        <section id="quote" className="tc-enter scroll-mt-24" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
          <div className="mx-auto max-w-2xl">
            <p className="tc-kicker text-center">Free quote</p>
            <h2 className="tc-display mt-2 mb-3 text-center text-3xl text-white">
              Tell us what needs clearing
            </h2>
            <p className="mb-8 text-center text-sm text-white/50">
              We&apos;ll get back to you with a flat number, usually same day.
            </p>
            <CleanoutQuoteForm />
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-5 py-8 text-center">
        <div className="tc-hazard mx-auto mb-6 h-1 max-w-xs" aria-hidden="true" />
        <p className="text-sm text-white/30">
          &copy; {new Date().getFullYear()} Tolley Cleanouts &middot; {TC_AREA} &middot;{" "}
          <a href={TC_PHONE_TEL} className="text-[#ff7a1a]/60 hover:text-[#ff7a1a]">
            {TC_PHONE}
          </a>
        </p>
        <p className="mt-1 text-xs text-white/20">
          Part of{" "}
          <a href="https://www.tolley.io/start" className="text-white/30 hover:text-white/50">
            tolley.io
          </a>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-white/20">
          <a href="/junkinjays" className="hover:text-white/40">Scrap &amp; Junk</a>
          <a href="/trailer" className="hover:text-white/40">Trailers</a>
          <a href="/wd" className="hover:text-white/40">W/D Rental</a>
          <a href="/homes" className="hover:text-white/40">Real Estate</a>
          <a href="/moving" className="hover:text-white/40">Moving</a>
          <a href="/shop" className="hover:text-white/40">Shop</a>
        </div>
      </footer>
      <MoreFromTolley currentSubsite="cleanouts" />
    </main>
  );
}
