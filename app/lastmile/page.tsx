import { LmCta } from "@/components/lastmile/lm-cta";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { LmFleet } from "@/components/lastmile/lm-fleet";
import { LmGallery } from "@/components/lastmile/lm-gallery";
import { LmHero } from "@/components/lastmile/lm-hero";
import { LmServices } from "@/components/lastmile/lm-services";
import { LmWhy } from "@/components/lastmile/lm-why";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Red Alert Dispatch — Last-Mile Delivery",
  description: "Fast last-mile delivery for contractors and businesses in Kansas City. 3,000+ deliveries, 8 vehicles and trailers up to 10,000 lbs. Starting at $2/mile.",
  url: "https://www.tolley.io/lastmile",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  priceRange: "Starting at $2/mile",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Overland Park", containedInPlace: { "@type": "State", name: "Kansas" } },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much does last-mile delivery cost in Kansas City?",
      acceptedAnswer: { "@type": "Answer", text: "Pricing starts at $2/mile. Red Alert Dispatch is transparent — no surge pricing, no hidden fees. Clients save vs Dispatch, Roadie, and GoShare." },
    },
    {
      "@type": "Question",
      name: "What can Red Alert Dispatch deliver?",
      acceptedAnswer: { "@type": "Answer", text: "We handle freight up to 10,000 lbs using 8 vehicles including cargo vans, pickup trucks, and trailers. Contractor supplies, furniture, equipment, and oversized items." },
    },
    {
      "@type": "Question",
      name: "Does Red Alert Dispatch serve the full Kansas City metro?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. We serve Independence, Kansas City MO and KS, Lee's Summit, Blue Springs, Overland Park, and surrounding areas." },
    },
    {
      "@type": "Question",
      name: "How do I request a delivery quote?",
      acceptedAnswer: { "@type": "Answer", text: "Visit tolley.io/lastmile and use the quote form, or call 913-283-3826. Quotes are fast and transparent." },
    },
    {
      "@type": "Question",
      name: "How many deliveries has Red Alert Dispatch completed?",
      acceptedAnswer: { "@type": "Answer", text: "Over 3,000 deliveries completed across the Kansas City metro — contractors, businesses, and individual clients." },
    },
  ],
};

export default function LastmilePage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <LmHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="lm-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <LmFleet />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <LmServices />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <LmWhy />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <LmGallery />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
          <LmCta />
        </div>

        {/* FAQ Section */}
        <div className="lm-enter" style={{ "--enter-delay": "0.6s" } as React.CSSProperties}>
          <section className="rounded-xl border border-red-900/30 bg-red-950/10 p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-wide text-red-400 uppercase">FAQ</h2>
            <div className="mt-5 space-y-3">
              {faqJsonLd.mainEntity.map((item) => (
                <div key={item.name} className="rounded-lg border border-red-900/20 bg-red-950/20 p-5">
                  <h3 className="font-bold text-white">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <MoreFromTolley currentSubsite="lastmile" />
    </main>
  );
}
