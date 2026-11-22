import { WD_PRICE_WASHER, WD_PRICE_BUNDLE, WD_CONTACT_PHONE, WD_CONTACT_EMAIL, WD_FACEBOOK_URL } from "@/lib/wd";
import { discoveryMetadata } from "@/lib/discovery";
import { PublicOfferDetails } from "@/components/shared/public-offer-details";
import { Suspense } from "react";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
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
    `Washer rental for $${WD_PRICE_WASHER}/month or a washer and dryer for $${WD_PRICE_BUNDLE}/month in Kansas City. Free delivery, installation, and maintenance included. No contracts.`,
  url: "https://www.tolley.io/wd",
  telephone: WD_CONTACT_PHONE,
  email: WD_CONTACT_EMAIL,
  priceRange: `$${WD_PRICE_WASHER}–$${WD_PRICE_BUNDLE}/mo`,
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
      { name: "Washer Rental", price: WD_PRICE_WASHER },
      { name: "Washer + Dryer Rental", price: WD_PRICE_BUNDLE },
    ].map(({ name, price }) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name },
      price: price.toFixed(2),
      priceCurrency: "USD",
      priceSpecification: { "@type": "UnitPriceSpecification", price: price.toFixed(2), priceCurrency: "USD", unitCode: "MON" },
      // Inventory and delivery dates require provider confirmation.
    })),
  },
  sameAs: [WD_FACEBOOK_URL],
};

function WdPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
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

export const metadata = discoveryMetadata("wd");

export default function PublicLanding() {
  return <><WdPage /><PublicOfferDetails name="wd" /></>;
}
