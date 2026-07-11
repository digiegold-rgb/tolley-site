import { Suspense } from "react";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { WdHero } from "@/components/wd/wd-hero";
import { WdHowItWorks } from "@/components/wd/wd-how-it-works";
import { WdPricing } from "@/components/wd/wd-pricing";
import { WdServiceArea } from "@/components/wd/wd-service-area";
import { WdLeadForm } from "@/components/wd/wd-lead-form";
import { WdFaq } from "@/components/wd/wd-faq";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What's included in the washer dryer rental?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every rental includes free delivery, professional installation, ongoing maintenance, and replacement coverage if a machine fails. You just pay the monthly subscription.",
      },
    },
    {
      "@type": "Question",
      name: "How much does washer and dryer rental cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Washer only is $42/mo. Washer + dryer bundle is $58/mo. No hidden fees, no deposits.",
      },
    },
    {
      "@type": "Question",
      name: "How do I cancel my washer dryer rental?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cancel anytime before your next billing date — no cancellation fees. We'll schedule a pickup within 5 business days.",
      },
    },
    {
      "@type": "Question",
      name: "What areas does washer dryer rental serve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We cover the Kansas City metro including Independence, Lee's Summit, Blue Springs, Raytown, Grandview, Overland Park, Olathe, Liberty, Gladstone, Belton, and both Kansas City MO & KS.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if my rental machine breaks down?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We repair or replace within 48 hours at no extra cost. Just report the issue and we handle the rest.",
      },
    },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Wash & Dry Rental by Your KC Homes LLC",
  description:
    "Affordable washer and dryer rentals in Kansas City with free delivery, installation, and maintenance included. No contracts. $58/mo.",
  url: "https://www.tolley.io/wd",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  priceRange: "$58/mo",
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
        itemOffered: { "@type": "Product", name: "Washer + Dryer Rental" },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* FAQPage structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
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
      <MoreFromTolley currentSubsite="wd" />
    </main>
  );
}
