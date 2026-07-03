import { TrailerHero } from "@/components/trailer/trailer-hero";
import { TrailerFleet } from "@/components/trailer/trailer-fleet";
import { TrailerHowItWorks } from "@/components/trailer/trailer-how-it-works";
import { TrailerInfo } from "@/components/trailer/trailer-info";
import { TrailerFaq } from "@/components/trailer/trailer-faq";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Trailer Rental by Your KC Homes LLC",
  description: "Utility trailer rentals in Independence, MO. 16ft, 18ft, and 20ft trailers up to 10,000 lb capacity. No plates needed. All payments accepted.",
  url: "https://www.tolley.io/trailer",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  priceRange: "$68–$228/day",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Trailer Rentals",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "16ft Utility Trailer" }, price: "68.00", priceCurrency: "USD" },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "18ft Dual Axle Utility Trailer" }, price: "98.00", priceCurrency: "USD" },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "20ft Utility Trailer" }, price: "98.00", priceCurrency: "USD" },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "20ft Car Hauler" }, price: "228.00", priceCurrency: "USD" },
    ],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do trailer rentals have license plates?",
      acceptedAnswer: { "@type": "Answer", text: "No. Our trailers do not have license plates. When hooked to your vehicle, coverage falls under your auto insurance." },
    },
    {
      "@type": "Question",
      name: "What payment methods does trailer rental accept?",
      acceptedAnswer: { "@type": "Answer", text: "Everything — cash, card, Venmo, Zelle, CashApp. There's a cash box at the trailer location for after-hours or weekend pickups." },
    },
    {
      "@type": "Question",
      name: "Do I need insurance to rent a trailer?",
      acceptedAnswer: { "@type": "Answer", text: "Your vehicle's insurance covers the trailer while it's hooked up. We recommend confirming with your insurer that you have trailer liability coverage." },
    },
    {
      "@type": "Question",
      name: "What trailer sizes are available?",
      acceptedAnswer: { "@type": "Answer", text: "We have a 16ft single axle (2,500 lbs), an 18ft dual axle (7,000 lbs), a 20ft utility (7,000 lbs), and a 20ft car hauler (10,000 lbs)." },
    },
    {
      "@type": "Question",
      name: "How do I book a trailer rental?",
      acceptedAnswer: { "@type": "Answer", text: "Message us on Facebook Marketplace. We'll confirm availability — then just show up with your driver's license and you're on your way." },
    },
  ],
};

export default function TrailerPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <TrailerHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="trailer-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <TrailerFleet />
        </div>
        <div className="trailer-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <TrailerHowItWorks />
        </div>
        <div className="trailer-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <TrailerInfo />
        </div>
        <div className="trailer-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <TrailerFaq />
        </div>
      </div>
    </main>
  );
}
