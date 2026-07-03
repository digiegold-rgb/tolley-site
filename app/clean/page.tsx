import Image from "next/image";
import {
  CL_PHONE,
  CL_PHONE_TEL,
  CL_PHONE_SMS,
  CL_BRAND,
  CL_COMPANY,
  CL_AREA,
  CL_TRUST,
  CL_SERVICES,
  CL_GALLERY,
  CL_STEPS,
  CL_FAQ,
} from "@/lib/clean";
import { CleanQuoteForm } from "@/components/clean/quote-form";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: `${CL_BRAND} by ${CL_COMPANY}`,
  description:
    "Junk & trash removal, estate and rental cleanouts, furniture moving, and car / truck / equipment transport across the Kansas City metro. Trailer rental available. Free quotes, $3/mile delivery.",
  url: "https://www.tolley.io/clean",
  telephone: CL_PHONE,
  email: "Jared@yourkchomes.com",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Hauling, Cleanout & Moving Services",
    itemListElement: CL_SERVICES.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.title, description: s.desc },
    })),
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CL_FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function CleanPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>

      {/* Sticky call/text strip */}
      <div className="sticky top-0 z-50">
        <div className="cl-hazard h-1.5" aria-hidden="true" />
        <div className="cl-strip flex items-center justify-center gap-3 px-4 py-2.5 text-center">
          <span className="cl-display text-sm font-semibold text-white">Free Quotes</span>
          <span className="text-white/30">|</span>
          <a
            href={CL_PHONE_TEL}
            data-track-event="phone_click"
            data-track-label="clean_strip"
            className="text-sm font-bold text-[#ff7a1a] underline decoration-[#ff7a1a]/40 underline-offset-2 hover:decoration-[#ff7a1a]"
          >
            {CL_PHONE}
          </a>
          <span className="text-white/30">|</span>
          <a href={CL_PHONE_SMS} className="text-xs text-white/70 hover:text-white">
            Call or Text
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="cl-hero px-5 pt-20 pb-24 text-center sm:pt-28 sm:pb-28">
        <Image
          src="/lastmile/car-haul.jpg"
          alt="Vehicle loaded and strapped on our 20ft car hauler"
          fill
          priority
          sizes="100vw"
          className="cl-hero-img"
        />
        <div className="cl-hero-scrim" aria-hidden="true" />
        <div className="cl-hero-grid" aria-hidden="true" />

        <div className="mx-auto max-w-3xl">
          <p className="cl-kicker">{CL_BRAND} · {CL_AREA}</p>
          <h1 className="cl-display mt-4 text-4xl font-bold text-white sm:text-6xl">
            We clear it, move it,{" "}
            <span className="text-[#ff7a1a]">or haul it.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/70 sm:text-xl">
            Junk removal, estate &amp; rental cleanouts, furniture moves, and car,
            truck &amp; equipment transport — one local crew, one phone number, one
            flat price.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={CL_PHONE_TEL}
              data-track-event="phone_click"
              data-track-label="clean_hero"
              className="cl-btn-primary rounded px-8 py-4 text-lg font-bold"
            >
              Call {CL_PHONE}
            </a>
            <a href={CL_PHONE_SMS} className="cl-btn-secondary rounded px-8 py-4 text-lg font-bold">
              Text Photos for a Quote
            </a>
          </div>

          {/* Trust chips */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            {CL_TRUST.map((t) => (
              <span key={t} className="cl-chip">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-5 pb-24 sm:px-8">
        {/* Services */}
        <section className="cl-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <p className="cl-kicker text-center">What we do</p>
          <h2 className="cl-display mt-2 mb-3 text-center text-3xl text-white sm:text-4xl">
            One crew for the heavy, dirty, awkward stuff
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-white/55">
            If it needs to be lifted, loaded, cleared, moved, or hauled — we&apos;ve
            got the truck, the trailers, and the car hauler to do it.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CL_SERVICES.map((svc) => (
              <article key={svc.title} className="cl-svc flex flex-col">
                <div className="cl-svc-media">
                  <span className="cl-svc-tag">{svc.tag}</span>
                  <Image
                    src={svc.image}
                    alt={svc.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="cl-display text-lg text-white">{svc.title}</h3>
                  <p className="mt-2 text-sm text-white/55">{svc.desc}</p>
                  <ul className="mt-4 space-y-1.5">
                    {svc.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-white/45">
                        <span className="cl-bullet" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* The rigs — photo strip */}
        <section className="cl-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <p className="cl-kicker text-center">The rigs we run</p>
          <h2 className="cl-display mt-2 mb-8 text-center text-3xl text-white">
            Real trucks, real trailers, real loads
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CL_GALLERY.map((shot) => (
              <div key={shot.src} className="cl-shot">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="cl-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <p className="cl-kicker text-center">How it works</p>
          <h2 className="cl-display mt-2 mb-8 text-center text-3xl text-white">
            Three steps. One trip.
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CL_STEPS.map((step) => (
              <div key={step.num} className="cl-card p-6">
                <div className="cl-step-num">{step.num}</div>
                <h3 className="cl-display mt-4 text-lg text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-white/50">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing / $3 a mile + in-person quote */}
        <section className="cl-enter" style={{ "--enter-delay": "0.25s" } as React.CSSProperties}>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="cl-plate flex flex-col justify-center p-8 text-center sm:p-10">
              <p className="cl-kicker">Delivery &amp; transport</p>
              <div className="mt-3 flex items-baseline justify-center gap-2">
                <span className="cl-price text-6xl sm:text-7xl">$3</span>
                <span className="cl-display text-xl text-white/70">/ loaded mile</span>
              </div>
              <p className="mx-auto mt-4 max-w-sm text-sm text-white/60">
                Marketplace pickups, appliance and lumber runs, vehicle and equipment
                transport — a flat, honest rate, quoted before we roll. No fuel
                surcharges, no fine print.
              </p>
            </div>
            <div className="cl-card flex flex-col justify-center p-8 text-center sm:p-10">
              <p className="cl-kicker">Cleanouts &amp; moves</p>
              <h3 className="cl-display mt-3 text-3xl text-white">Quoted flat, in person</h3>
              <p className="mx-auto mt-4 max-w-sm text-sm text-white/60">
                For bigger jobs we come look at it — free — and give you one flat
                number for the whole thing before any work starts. What you approve is
                the most you&apos;ll pay, and resale value comes off the top.
              </p>
              <div className="mt-6">
                <a
                  href={CL_PHONE_TEL}
                  data-track-event="phone_click"
                  data-track-label="clean_pricing"
                  className="cl-btn-primary inline-block rounded px-7 py-3.5 text-base font-bold"
                >
                  Call {CL_PHONE}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The Tolley difference */}
        <section className="cl-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <div className="cl-plate p-8 text-center sm:p-12">
            <p className="cl-kicker">The Tolley difference</p>
            <h2 className="cl-display mt-3 text-3xl text-white sm:text-4xl">
              Run like it&apos;s a listing, not a junk truck
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              We&apos;re a licensed Missouri real-estate operation with a full-time
              crew — so we show up on time, treat your property with care, and clean up
              behind us. And anything with resale value we haul off gets{" "}
              <span className="font-semibold text-[#ff7a1a]">credited against your bill</span>
              . We resell it, you save.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="cl-enter" style={{ "--enter-delay": "0.35s" } as React.CSSProperties}>
          <p className="cl-kicker text-center">Good questions</p>
          <h2 className="cl-display mt-2 mb-8 text-center text-3xl text-white">FAQ</h2>
          <div className="mx-auto max-w-2xl space-y-3">
            {CL_FAQ.map((faq) => (
              <details key={faq.q} className="cl-form group overflow-hidden">
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
        <section id="quote" className="cl-enter scroll-mt-24" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <div className="mx-auto max-w-2xl">
            <p className="cl-kicker text-center">Free quote</p>
            <h2 className="cl-display mt-2 mb-3 text-center text-3xl text-white">
              Tell us what you&apos;ve got
            </h2>
            <p className="mb-8 text-center text-sm text-white/50">
              We&apos;ll call or text you back to set up a quote — usually same day.
            </p>
            <CleanQuoteForm />
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-5 py-8 text-center">
        <div className="cl-hazard mx-auto mb-6 h-1 max-w-xs" aria-hidden="true" />
        <p className="text-sm text-white/30">
          &copy; {new Date().getFullYear()} {CL_BRAND} &middot; {CL_COMPANY} &middot; {CL_AREA} &middot;{" "}
          <a href={CL_PHONE_TEL} className="text-[#ff7a1a]/60 hover:text-[#ff7a1a]">
            {CL_PHONE}
          </a>
        </p>
        <p className="mt-1 text-xs text-white/20">
          Part of{" "}
          <a href="https://www.tolley.io/start" className="text-white/30 hover:text-white/50">
            tolley.io
          </a>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-white/20">
          <a href="/cleanouts" className="hover:text-white/40">Cleanouts</a>
          <a href="/junkinjays" className="hover:text-white/40">Scrap &amp; Junk</a>
          <a href="/trailer" className="hover:text-white/40">Trailer Rental</a>
          <a href="/moving" className="hover:text-white/40">Moving Supplies</a>
          <a href="/wd" className="hover:text-white/40">W/D Rental</a>
          <a href="/homes" className="hover:text-white/40">Real Estate</a>
          <a href="/shop" className="hover:text-white/40">Shop</a>
        </div>
      </footer>
    </main>
  );
}
