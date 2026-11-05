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
import { WD_SERVICE_CITY_LABELS } from "@/lib/wd-service-zips";


const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Wash & Dry Rental by Your KC Homes LLC",
  description:
    "Washer and dryer rentals within about 25 minutes of Independence, MO. Free delivery, installation, and maintenance. No contracts. $42/mo washer or $58/mo bundle.",
  url: "https://www.tolley.io/wd",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  priceRange: "$58/mo",
  currenciesAccepted: "USD",
  paymentAccepted: "Credit Card",
  areaServed: WD_SERVICE_CITY_LABELS.map((name) => ({
    "@type": "City",
    name,
    containedInPlace: { "@type": "State", name: "Missouri" },
  })),
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

function WdPage({ paid }: { paid?: boolean }) {
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
        {paid && (
          <p role="status" className="rounded-2xl bg-white p-4 text-sm font-semibold text-blue-900 shadow">
            Payment received. We&apos;ll reach out to schedule your delivery.
          </p>
        )}
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

export default async function PublicLanding({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string | string[] }>;
}) {
  const params = await searchParams;
  const checkout = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout;
  return <><WdPage paid={checkout === "success"} /><PublicOfferDetails name="wd" /></>;
}
