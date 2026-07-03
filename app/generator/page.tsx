import { GeneratorHero } from "@/components/generator/generator-hero";
import { GeneratorGallery } from "@/components/generator/generator-gallery";
import { GeneratorUses } from "@/components/generator/generator-uses";
import { GeneratorSpecs } from "@/components/generator/generator-specs";
import { GeneratorCrossSell } from "@/components/generator/generator-cross-sell";
import { GeneratorFaq } from "@/components/generator/generator-faq";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Generator Rental by Your KC Homes LLC",
  description: "Tri-fuel generator rental in Independence, MO. 9,400W starting watts — gasoline, propane, or natural gas. Perfect for parties, bounce houses, and power outages.",
  url: "https://www.tolley.io/generator",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  priceRange: "$68–$800",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Generator Rental",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Generator Rental – Daily" }, price: "68.00", priceCurrency: "USD" },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Generator Rental – Weekly" }, price: "260.00", priceCurrency: "USD" },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Generator Rental – Monthly" }, price: "800.00", priceCurrency: "USD" },
    ],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What fuel types does the rental generator use?",
      acceptedAnswer: { "@type": "Answer", text: "This is a tri-fuel generator — it runs on gasoline, propane (LP), or natural gas. You pick whichever is most convenient for your setup." },
    },
    {
      "@type": "Question",
      name: "How much does generator rental cost?",
      acceptedAnswer: { "@type": "Answer", text: "$68/day (24 hours), $260/week (7 full days), or $800/month (30 days). All forms of payment accepted — cash, card, Venmo, Zelle, CashApp." },
    },
    {
      "@type": "Question",
      name: "Do you deliver the rental generator?",
      acceptedAnswer: { "@type": "Answer", text: "Yes! Free delivery within 5 miles and free pickup when you're done. Call 913-283-3826 to coordinate." },
    },
    {
      "@type": "Question",
      name: "Can the generator power a bounce house?",
      acceptedAnswer: { "@type": "Answer", text: "Absolutely! Bounce house blowers typically draw 1,000–1,500W. This generator can power multiple inflatables at once with plenty of headroom for lights and speakers too." },
    },
    {
      "@type": "Question",
      name: "What can a 9,400W generator power?",
      acceptedAnswer: { "@type": "Answer", text: "With 9,400W starting watts and 7,500W running watts, it can handle bounce houses, refrigerators, A/C units, power tools, DJ equipment, outdoor lighting, and more — often several at once." },
    },
  ],
};

export default function GeneratorPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <GeneratorHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="generator-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <GeneratorGallery />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <GeneratorUses />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <GeneratorSpecs />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <GeneratorCrossSell />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <GeneratorFaq />
        </div>
      </div>
    </main>
  );
}
