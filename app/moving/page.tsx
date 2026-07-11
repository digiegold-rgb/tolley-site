import { MovingHero } from "@/components/moving/moving-hero";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { MovingGallery } from "@/components/moving/moving-gallery";
import { MovingBundle } from "@/components/moving/moving-bundle";
import { MovingPricing } from "@/components/moving/moving-pricing";
import { MovingWhy } from "@/components/moving/moving-why";
import { MovingFaq } from "@/components/moving/moving-faq";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Moving Supply Rental by Your KC Homes LLC",
  description: "Rent 20 heavy-duty totes, 25 moving blankets, and rubber bands. $38/day in Independence, MO. Skip the cardboard. All payments accepted.",
  url: "https://www.tolley.io/moving",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  priceRange: "$38–$228",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Moving Supply Rental Bundle",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Moving Bundle – Daily" }, price: "38.00", priceCurrency: "USD" },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Moving Bundle – Weekly" }, price: "158.00", priceCurrency: "USD" },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Moving Bundle – 2 Weeks" }, price: "228.00", priceCurrency: "USD" },
    ],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What's included in the moving supply rental bundle?",
      acceptedAnswer: { "@type": "Answer", text: "20 heavy-duty reusable totes, 17 giant rubber bands to keep them secure, and 25 thick moving blankets to protect your furniture. Easy labels are included too." },
    },
    {
      "@type": "Question",
      name: "How much does moving supply rental cost?",
      acceptedAnswer: { "@type": "Answer", text: "$38/day (24 hours), $158/week (7 full days), or $228 for 2 weeks (14 days). All forms of payment accepted — cash, card, Venmo, Zelle, CashApp." },
    },
    {
      "@type": "Question",
      name: "Why use reusable totes instead of cardboard boxes for moving?",
      acceptedAnswer: { "@type": "Answer", text: "Totes are sturdier, stackable, waterproof, and reusable. They don't collapse under weight, don't need tape, and make your move way faster and cleaner." },
    },
    {
      "@type": "Question",
      name: "How do I book moving supply rental?",
      acceptedAnswer: { "@type": "Answer", text: "Message us on Facebook Marketplace — tap the listing and hit Message. We'll confirm availability and get you set up." },
    },
    {
      "@type": "Question",
      name: "Do you deliver moving supplies?",
      acceptedAnswer: { "@type": "Answer", text: "Local moves only. Message us on Facebook to coordinate pickup or delivery." },
    },
  ],
};

export default function MovingPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <MovingHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="moving-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <MovingGallery />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <MovingBundle />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <MovingPricing />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <MovingWhy />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <MovingFaq />
        </div>
      </div>
      <MoreFromTolley currentSubsite="moving" />
    </main>
  );
}
