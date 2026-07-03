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
import { MpServiceCards } from "@/components/moupins/mp-service-cards";
import { MpFaq } from "@/components/moupins/mp-faq";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Precision Transfer & Removal",
  description: "Junk removal and moving services in Kansas City. Same-day removal available. Free quotes via text. Garage cleanouts, appliance haul-off, local moves.",
  url: "https://www.tolley.io/moupins",
  telephone: "+18164422483",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Raytown", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Grandview", containedInPlace: { "@type": "State", name: "Missouri" } },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Junk Removal & Moving Services",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Junk Removal" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Moving Services" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Appliance Removal" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Yard & Outdoor Cleanup" } },
    ],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: MP_FAQ.slice(0, 5).map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function MoupinsPage() {
  return (
    <MpPageClient>
      <main className="relative z-10 min-h-screen">
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        {/* Dot grid background */}
        <div
          aria-hidden="true"
          className="mp-dot-grid pointer-events-none fixed inset-0 z-0"
        />

        {/* Sticky phone strip */}
        <div className="mp-phone-strip sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-2">
          <span className="text-[0.65rem] font-bold tracking-[0.15em] text-white/90 uppercase">
            Free Quotes
          </span>
          <div className="h-3 w-px bg-white/25" />
          <a
            href={MP_SMS}
            data-phone-click="sms_strip"
            className="text-sm font-bold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white transition"
          >
            {MP_PHONE}
          </a>
          <div className="hidden h-3 w-px bg-white/25 sm:block" />
          <span className="hidden text-xs text-white/60 sm:block">
            Text for fastest response
          </span>
        </div>

        {/* Hero */}
        <section className="mp-hero-bg relative overflow-hidden px-5 pt-20 pb-20 text-center sm:pt-28 sm:pb-28">
          <div className="relative z-10 mx-auto max-w-3xl">
            {/* Badge */}
            <div className="mp-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/[0.06] px-4 py-1.5 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[0.68rem] tracking-[0.14em] text-green-300/70 uppercase">
                Junk Removal &amp; Moving
              </span>
            </div>

            <h1
              className="mp-fade-up mp-fade-up-d1 text-3xl font-bold tracking-tight sm:text-5xl md:text-6xl"
              style={{ fontFamily: "var(--font-russo), sans-serif" }}
            >
              <span className="mp-gradient-text">Precision Transfer</span>
              <br />
              <span className="text-white/90">&amp; Removal</span>
            </h1>

            <p className="mp-fade-up mp-fade-up-d2 mx-auto mt-4 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
              Garage cleanouts, appliance haul-off, local moves — one message
              gets you a free quote. Same-day service in {MP_AREA}.
            </p>

            {/* CTAs */}
            <div className="mp-fade-up mp-fade-up-d3 mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={MP_SMS}
                data-phone-click="sms_hero"
                className="mp-btn-glow rounded-full bg-green-600 px-8 py-3.5 text-sm font-bold tracking-[0.1em] text-white uppercase hover:bg-green-700 transition-colors"
              >
                Message {MP_PHONE}
              </a>
              <a
                href={MP_PHONE_TEL}
                data-phone-click="call_hero"
                className="mp-btn-gold rounded-full border border-yellow-500/35 bg-yellow-500/[0.08] px-8 py-3.5 text-sm font-bold tracking-[0.1em] text-yellow-400 uppercase hover:bg-yellow-500/15 transition-colors"
              >
                Call Instead
              </a>
            </div>

            <p className="mp-fade-up mp-fade-up-d4 mt-6 text-[0.65rem] tracking-[0.12em] text-white/30 uppercase">
              Send a photo for the fastest quote
            </p>
          </div>
        </section>

        <div className="relative z-10 mx-auto max-w-6xl space-y-16 px-5 pb-20 sm:px-8">
          {/* Services */}
          <section>
            <div className="mb-8 text-center">
              <p className="text-[0.72rem] font-medium tracking-[0.42em] text-green-400/60 uppercase">
                Services
              </p>
              <h2
                className="mt-3 text-2xl font-bold text-white/95 sm:text-3xl"
                style={{ fontFamily: "var(--font-russo)" }}
              >
                What We Do
              </h2>
            </div>
            <MpServiceCards services={MP_SERVICES} />
          </section>

          {/* Why Precision */}
          <section>
            <div className="mb-8 text-center">
              <p className="text-[0.72rem] font-medium tracking-[0.42em] text-yellow-500/60 uppercase">
                Why Us
              </p>
              <h2
                className="mt-3 text-2xl font-bold text-white/95 sm:text-3xl"
                style={{ fontFamily: "var(--font-russo)" }}
              >
                Why Precision?
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {MP_WHY.map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-yellow-500/12 bg-yellow-500/[0.03] p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-yellow-500/25 hover:shadow-[0_12px_32px_rgba(234,179,8,0.08)]"
                >
                  <div className="mb-3 text-2xl">{item.emoji}</div>
                  <h3 className="text-sm font-bold text-white/90">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-white/45">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Gallery Placeholders */}
          <section>
            <div className="mb-6 text-center">
              <p className="text-[0.72rem] font-medium tracking-[0.42em] text-green-400/60 uppercase">
                Portfolio
              </p>
              <h2
                className="mt-3 text-2xl font-bold text-white/95 sm:text-3xl"
                style={{ fontFamily: "var(--font-russo)" }}
              >
                Our Work
              </h2>
              <p className="mt-2 text-sm text-white/40">
                Photos coming soon — check back for before &amp; after shots
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MP_GALLERY_PLACEHOLDERS.map((ph) => (
                <div
                  key={ph.slot}
                  className="mp-gallery-placeholder flex aspect-[4/3] flex-col items-center justify-center rounded-2xl"
                >
                  <div className="mb-2 text-2xl opacity-20">
                    {ph.slot <= 2 ? "\u{1F4F7}" : ph.slot <= 4 ? "\u{1F69A}" : "\u{2B50}"}
                  </div>
                  <p className="px-3 text-center text-[0.65rem] text-white/20">
                    {ph.alt}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Big CTA */}
          <section>
            <div className="mp-shimmer-border relative overflow-hidden rounded-3xl border border-green-500/15 bg-[linear-gradient(160deg,rgba(22,163,74,0.08),rgba(234,179,8,0.04)),rgba(8,12,5,0.6)] p-10 text-center shadow-[0_20px_48px_rgba(5,10,3,0.6)] backdrop-blur-xl sm:p-16">
              {/* Radial glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(22,163,74,0.08),transparent_70%)]"
              />

              <div className="relative z-10">
                <h2
                  className="text-3xl font-bold text-white/95 sm:text-4xl"
                  style={{ fontFamily: "var(--font-russo)" }}
                >
                  Ready to Get Rid of It?
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-white/55">
                  One message and we&apos;ll quote it. Junk removal, moving,
                  appliance haul-off —{" "}
                  <span className="font-semibold text-yellow-400/80">
                    same-day service available
                  </span>
                  .
                </p>
                <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <a
                    href={MP_SMS}
                    data-phone-click="sms_cta"
                    className="mp-btn-glow rounded-full bg-green-600 px-10 py-4 text-sm font-bold tracking-[0.1em] text-white uppercase hover:bg-green-700 transition-colors"
                  >
                    Message for a Free Quote
                  </a>
                  <a
                    href={MP_PHONE_TEL}
                    data-phone-click="call_cta"
                    className="mp-btn-gold rounded-full border border-yellow-500/35 bg-yellow-500/[0.08] px-10 py-4 text-sm font-bold tracking-[0.1em] text-yellow-400 uppercase hover:bg-yellow-500/15 transition-colors"
                  >
                    Call {MP_PHONE}
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <div className="mb-8 text-center">
              <p className="text-[0.72rem] font-medium tracking-[0.42em] text-green-400/60 uppercase">
                FAQ
              </p>
              <h2
                className="mt-3 text-2xl font-bold text-white/95 sm:text-3xl"
                style={{ fontFamily: "var(--font-russo)" }}
              >
                Questions?
              </h2>
            </div>
            <MpFaq faqs={MP_FAQ} />
          </section>

          {/* Service Area */}
          <section className="rounded-2xl border border-green-500/10 bg-green-500/[0.03] p-6 text-center sm:p-8">
            <h2
              className="text-lg font-bold text-green-400/80"
              style={{ fontFamily: "var(--font-russo)" }}
            >
              Service Area
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/45">
              Independence, Blue Springs, Lee&apos;s Summit, Raytown,
              Grandview, Belton, Grain Valley, Oak Grove, Sugar Creek, Kansas
              City MO &amp; KS — and surrounding areas.
            </p>
            <p className="mt-2 text-xs text-white/25">
              Not sure if we cover your area? Message and ask — we go far for
              good jobs.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 px-5 py-8 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent"
          />
          <p className="text-sm text-white/30">
            &copy; {new Date().getFullYear()} Precision Transfer &amp; Removal
            &middot; {MP_AREA}
          </p>
          <p className="mt-1 text-xs text-white/20">
            Part of{" "}
            <a
              href="https://www.tolley.io/start"
              className="text-green-500/40 transition hover:text-green-500/70"
            >
              tolley.io
            </a>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-white/20">
            <a href="/trailer" className="transition hover:text-white/40">Trailers</a>
            <a href="/wd" className="transition hover:text-white/40">W/D Rental</a>
            <a href="/junkinjays" className="transition hover:text-white/40">Junkin&apos; Jay&apos;s</a>
            <a href="/homes" className="transition hover:text-white/40">Real Estate</a>
            <a href="/hvac" className="transition hover:text-white/40">HVAC</a>
            <a href="/lastmile" className="transition hover:text-white/40">Delivery</a>
            <a href="/moving" className="transition hover:text-white/40">Moving</a>
            <a href="/shop" className="transition hover:text-white/40">Shop</a>
          </div>
        </footer>
      </main>
    </MpPageClient>
  );
}
