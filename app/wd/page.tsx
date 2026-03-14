import { Suspense } from "react";
import { WdHero } from "@/components/wd/wd-hero";
import { WdHowItWorks } from "@/components/wd/wd-how-it-works";
import { WdPricing } from "@/components/wd/wd-pricing";
import { WdServiceArea } from "@/components/wd/wd-service-area";
import { WdLeadForm } from "@/components/wd/wd-lead-form";
import { WdFaq } from "@/components/wd/wd-faq";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Wash & Dry Rental by Your KC Homes LLC",
  description:
    "Affordable washer and dryer rentals in Kansas City with free delivery, installation, and maintenance included. No contracts. Starting at $42/mo.",
  url: "https://www.tolley.io/wd",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  priceRange: "$42-$58/mo",
  currenciesAccepted: "USD",
  paymentAccepted: "Credit Card",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Raytown", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Grandview", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Liberty", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Gladstone", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Belton", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Kansas" } },
    { "@type": "City", name: "Overland Park", containedInPlace: { "@type": "State", name: "Kansas" } },
    { "@type": "City", name: "Olathe", containedInPlace: { "@type": "State", name: "Kansas" } },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Washer & Dryer Rentals",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: { "@type": "Product", name: "Washer Only Rental" },
        price: "42.00",
        priceCurrency: "USD",
        priceSpecification: { "@type": "UnitPriceSpecification", price: "42.00", priceCurrency: "USD", unitCode: "MON" },
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        itemOffered: { "@type": "Product", name: "Washer + Dryer Bundle Rental" },
        price: "58.00",
        priceCurrency: "USD",
        priceSpecification: { "@type": "UnitPriceSpecification", price: "58.00", priceCurrency: "USD", unitCode: "MON" },
        availability: "https://schema.org/InStock",
      },
    ],
  },
  sameAs: ["https://www.facebook.com/share/1AafKhE5tq/?mibextid=wwXIfr"],
};

export default function WdPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense>
        <WdHero />
      </Suspense>

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
        <div className="wd-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <WdHowItWorks />
        </div>
        <div className="wd-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <Suspense>
            <WdPricing />
          </Suspense>
        </div>
        <div className="wd-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <WdServiceArea />
        </div>
        <div className="wd-enter" style={{ "--enter-delay": "0.35s" } as React.CSSProperties}>
          <Suspense>
            <WdLeadForm />
          </Suspense>
        </div>
        <div className="wd-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <WdFaq />
        </div>
      </div>
    </main>
  );
}
