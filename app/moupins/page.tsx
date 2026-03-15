import {
  MP_SERVICES,
  MP_WHY,
  MP_FAQ,
  MP_PHONE,
  MP_PHONE_TEL,
  MP_SMS,
  MP_AREA,
  MP_GALLERY_PLACEHOLDERS,
} from "@/lib/moupins";
import { MpPageClient } from "@/components/moupins/mp-page-client";

export default function MoupinsPage() {
  return (
    <MpPageClient>
      <main className="relative z-10 min-h-screen">
        {/* Sticky phone strip */}
        <div className="mp-phone-strip sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-2.5 text-center">
          <span className="text-sm font-bold text-white tracking-wide">
            FREE QUOTES
          </span>
          <span className="text-white/40">|</span>
          <a
            href={MP_SMS}
            data-phone-click="sms_strip"
            className="text-sm font-bold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
          >
            {MP_PHONE}
          </a>
          <span className="text-white/40">|</span>
          <span className="text-xs text-white/70">Message for a Quote</span>
        </div>

        {/* Hero */}
        <section className="mp-hero-bg relative overflow-hidden px-5 pt-16 pb-20 text-center sm:pt-24 sm:pb-28">
          <div className="mx-auto max-w-3xl">
            <h1
              className="mp-glow-text text-3xl font-bold tracking-tight sm:text-5xl"
              style={{
                fontFamily: "var(--font-russo), sans-serif",
                color: "#16a34a",
              }}
            >
              PRECISION TRANSFER &amp; REMOVAL
            </h1>
            <p className="mt-1 text-xl text-white/70 sm:text-2xl">
              Junk Removal &amp; Moving
            </p>
            <p className="mt-2 text-sm text-[#eab308]/60">{MP_AREA}</p>

            <div className="mt-4 mx-auto max-w-md rounded-xl bg-[#eab308]/[0.08] border border-[#eab308]/20 px-5 py-3">
              <p className="text-[#eab308] font-semibold text-base sm:text-lg">
                Message me to get a free quote
              </p>
              <p className="text-[#eab308]/60 text-sm mt-0.5">
                Same-day removal
              </p>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={MP_SMS}
                data-phone-click="sms_hero"
                className="mp-cta-glow rounded-xl bg-[#16a34a] px-8 py-4 text-lg font-bold text-white shadow-lg hover:bg-[#15803d] transition-colors"
              >
                Message Now: {MP_PHONE}
              </a>
              <a
                href={MP_PHONE_TEL}
                data-phone-click="call_hero"
                className="mp-wiggle rounded-xl border border-[#eab308]/40 bg-[#eab308]/10 px-8 py-4 text-lg font-bold text-[#eab308] hover:bg-[#eab308]/20 transition-colors"
              >
                Call Instead
              </a>
            </div>

            <p className="mt-6 text-sm text-white/50 max-w-md mx-auto">
              Got junk you need gone? Moving somewhere new?
              <br />
              <span className="text-[#16a34a] font-semibold">
                Send a text with a photo for the fastest quote.
              </span>
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-12 px-5 pb-20 sm:px-8">
          {/* Services */}
          <div
            className="mp-enter mp-section-services"
            style={{ "--enter-delay": "0.1s" } as React.CSSProperties}
          >
            <h2
              className="text-2xl font-bold text-[#16a34a] mb-6 text-center"
              style={{ fontFamily: "var(--font-russo)" }}
            >
              WHAT WE DO
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {MP_SERVICES.map((svc) => (
                <div
                  key={svc.title}
                  className="mp-card rounded-xl bg-white/[0.03] border border-white/10 p-6"
                >
                  <h3 className="text-lg font-bold text-white mb-2">
                    <span className="mr-2">{svc.emoji}</span>
                    {svc.title}
                  </h3>
                  <p className="text-sm text-white/50 mb-3">
                    {svc.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {svc.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-[#16a34a]/10 border border-[#16a34a]/20 px-2.5 py-0.5 text-xs text-[#16a34a]/80"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why Precision */}
          <div
            className="mp-enter mp-section-why"
            style={{ "--enter-delay": "0.2s" } as React.CSSProperties}
          >
            <h2
              className="text-2xl font-bold text-[#eab308] mb-6 text-center"
              style={{ fontFamily: "var(--font-russo)" }}
            >
              WHY PRECISION?
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {MP_WHY.map((item) => (
                <div
                  key={item.title}
                  className="mp-card mp-card-gold rounded-xl bg-[#eab308]/[0.04] border border-[#eab308]/15 p-5 text-center"
                >
                  <div className="text-3xl mb-2">{item.emoji}</div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-white/40">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Photo Gallery Placeholders */}
          <div
            className="mp-enter mp-section-gallery"
            style={{ "--enter-delay": "0.3s" } as React.CSSProperties}
          >
            <h2
              className="text-2xl font-bold text-[#16a34a] mb-2 text-center"
              style={{ fontFamily: "var(--font-russo)" }}
            >
              OUR WORK
            </h2>
            <p className="text-sm text-white/40 mb-6 text-center">
              Photos coming soon — check back for before &amp; after shots
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MP_GALLERY_PLACEHOLDERS.map((ph) => (
                <div
                  key={ph.slot}
                  className="mp-gallery-placeholder rounded-xl aspect-[4/3] flex flex-col items-center justify-center"
                >
                  <div className="text-3xl mb-2 opacity-30">
                    {ph.slot <= 2
                      ? "\u{1F4F7}"
                      : ph.slot <= 4
                        ? "\u{1F69A}"
                        : "\u{2B50}"}
                  </div>
                  <p className="text-xs text-white/25 px-3 text-center">
                    {ph.alt}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Big CTA */}
          <div
            className="mp-enter"
            style={{ "--enter-delay": "0.4s" } as React.CSSProperties}
          >
            <div className="mp-cta-bg mp-neon-border rounded-2xl p-8 sm:p-12 text-center">
              <h2
                className="text-3xl font-bold text-white sm:text-4xl"
                style={{ fontFamily: "var(--font-russo)" }}
              >
                READY TO GET RID OF IT?
              </h2>
              <p className="mt-3 text-lg text-white/60 max-w-lg mx-auto">
                One message and we&apos;ll quote it. Junk removal, moving,
                appliance haul-off —{" "}
                <span className="text-[#eab308] font-semibold">
                  same-day service available
                </span>
                .
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <a
                  href={MP_SMS}
                  data-phone-click="sms_cta"
                  className="mp-cta-glow rounded-xl bg-[#16a34a] px-10 py-5 text-xl font-bold text-white shadow-lg hover:bg-[#15803d] transition-colors"
                >
                  MESSAGE FOR A FREE QUOTE
                </a>
                <a
                  href={MP_PHONE_TEL}
                  data-phone-click="call_cta"
                  className="mp-wiggle rounded-xl border-2 border-[#eab308]/50 bg-[#eab308]/10 px-10 py-5 text-xl font-bold text-[#eab308] hover:bg-[#eab308]/20 transition-colors"
                >
                  CALL {MP_PHONE}
                </a>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div
            className="mp-enter mp-section-faq"
            style={{ "--enter-delay": "0.5s" } as React.CSSProperties}
          >
            <h2
              className="text-2xl font-bold text-[#16a34a] mb-6 text-center"
              style={{ fontFamily: "var(--font-russo)" }}
            >
              QUESTIONS?
            </h2>
            <div className="space-y-3 max-w-2xl mx-auto">
              {MP_FAQ.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden"
                >
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-white/80 flex items-center justify-between hover:text-white transition-colors">
                    {faq.q}
                    <span className="text-[#eab308] text-xl group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-4 text-sm text-white/50">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Service Area */}
          <div
            className="mp-enter"
            style={{ "--enter-delay": "0.6s" } as React.CSSProperties}
          >
            <div className="mp-section-area rounded-xl p-6 text-center">
              <h2
                className="text-lg font-bold text-[#16a34a] mb-3"
                style={{ fontFamily: "var(--font-russo)" }}
              >
                SERVICE AREA
              </h2>
              <p className="text-sm text-white/50 max-w-lg mx-auto">
                Independence, Blue Springs, Lee&apos;s Summit, Raytown,
                Grandview, Belton, Grain Valley, Oak Grove, Sugar Creek, Kansas
                City MO &amp; KS — and surrounding areas.
              </p>
              <p className="mt-2 text-xs text-white/30">
                Not sure if we cover your area? Message and ask — we go far for
                good jobs.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/5 px-5 py-8 text-center">
          <p className="text-sm text-white/30">
            &copy; {new Date().getFullYear()} Precision Transfer &amp; Removal
            &middot; {MP_AREA}
          </p>
          <p className="mt-1 text-xs text-white/20">
            Part of{" "}
            <a
              href="https://www.tolley.io/start"
              className="text-[#16a34a]/40 hover:text-[#16a34a]/70"
            >
              tolley.io
            </a>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-white/20">
            <a href="/trailer" className="hover:text-white/40">
              Trailers
            </a>
            <a href="/wd" className="hover:text-white/40">
              W/D Rental
            </a>
            <a href="/junkinjays" className="hover:text-white/40">
              Junkin&apos; Jay&apos;s
            </a>
            <a href="/homes" className="hover:text-white/40">
              Real Estate
            </a>
            <a href="/hvac" className="hover:text-white/40">
              HVAC
            </a>
            <a href="/lastmile" className="hover:text-white/40">
              Delivery
            </a>
            <a href="/moving" className="hover:text-white/40">
              Moving
            </a>
            <a href="/shop" className="hover:text-white/40">
              Shop
            </a>
          </div>
        </footer>
      </main>
    </MpPageClient>
  );
}
