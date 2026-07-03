import { HvacHero } from "@/components/hvac/hvac-hero";
import { HvacServices } from "@/components/hvac/hvac-services";
import { HvacAbout } from "@/components/hvac/hvac-about";
import { HvacGallery } from "@/components/hvac/hvac-gallery";
import { HvacReviews } from "@/components/hvac/hvac-reviews";
import { HvacCta } from "@/components/hvac/hvac-cta";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HVACBusiness",
  name: "The Cool Guys Heating & Air Conditioning",
  description: "24/7 HVAC maintenance, repairs, and installation in Kansas City. 10+ years experience. Goodman equipment. Call (816) 726-4054.",
  url: "https://www.tolley.io/hvac",
  telephone: "+18167264054",
  openingHours: "Mo-Su 00:00-23:59",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Independence",
    addressRegion: "MO",
    addressCountry: "US",
  },
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Raytown", containedInPlace: { "@type": "State", name: "Missouri" } },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does The Cool Guys offer 24/7 HVAC service in Kansas City?",
      acceptedAnswer: { "@type": "Answer", text: "Yes — The Cool Guys are open 24 hours a day, 7 days a week for emergency HVAC repairs, AC failures, and furnace problems in Kansas City." },
    },
    {
      "@type": "Question",
      name: "What HVAC services does The Cool Guys offer?",
      acceptedAnswer: { "@type": "Answer", text: "We provide AC repair, furnace repair, HVAC installation, seasonal maintenance tune-ups, and emergency service for heating and cooling systems in Independence MO and the KC metro." },
    },
    {
      "@type": "Question",
      name: "What equipment does The Cool Guys install?",
      acceptedAnswer: { "@type": "Answer", text: "We install and service Goodman equipment — reliable, American-made HVAC systems with strong warranties." },
    },
    {
      "@type": "Question",
      name: "How do I schedule HVAC service in Kansas City?",
      acceptedAnswer: { "@type": "Answer", text: "Call The Cool Guys at (816) 726-4054. We serve Independence, Lee's Summit, Blue Springs, Raytown, and the greater KC metro." },
    },
    {
      "@type": "Question",
      name: "How experienced is The Cool Guys HVAC team?",
      acceptedAnswer: { "@type": "Answer", text: "Over 10 years of experience in Kansas City heating and air conditioning — repairs, installs, and maintenance for residential and commercial properties." },
    },
  ],
};

export default function HvacPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <HvacHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="hvac-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <HvacServices />
        </div>
        <div className="hvac-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <HvacAbout />
        </div>
        <div className="hvac-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <HvacGallery />
        </div>
      </div>

      {/* Reviews — full width, outside max-w container */}
      <div className="hvac-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
        <HvacReviews />
      </div>

      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
        {/* FAQ Section */}
        <div className="hvac-enter" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
          <section className="rounded-2xl border border-cyan-700/30 bg-cyan-950/20 p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-wide text-cyan-300 uppercase">FAQ</h2>
            <div className="mt-5 space-y-4">
              {faqJsonLd.mainEntity.map((item) => (
                <div key={item.name} className="rounded-xl border border-cyan-800/30 bg-cyan-950/30 p-5">
                  <h3 className="font-semibold text-white">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="hvac-enter" style={{ "--enter-delay": "0.6s" } as React.CSSProperties}>
          <HvacCta />
        </div>
      </div>
    </main>
  );
}
