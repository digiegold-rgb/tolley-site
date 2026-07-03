import { PoolsHero } from "@/components/pools/pools-hero";
import { PoolsHowItWorks } from "@/components/pools/pools-how-it-works";
import { PoolsProducts } from "@/components/pools/pools-products";
import { PoolsSavings } from "@/components/pools/pools-savings";
import { PoolsServiceArea } from "@/components/pools/pools-service-area";
import { PoolsFaq } from "@/components/pools/pools-faq";

export const revalidate = 600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Pool Supplies Delivered by Your KC Homes LLC",
  description: "Pool supplies at contractor pricing delivered to your door in Kansas City. Beat Walmart and Leslie's prices — no membership required.",
  url: "https://www.tolley.io/pools",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  areaServed: [
    { "@type": "City", name: "Independence", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Kansas City", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Lee's Summit", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Blue Springs", containedInPlace: { "@type": "State", name: "Missouri" } },
    { "@type": "City", name: "Overland Park", containedInPlace: { "@type": "State", name: "Kansas" } },
    { "@type": "City", name: "Lenexa", containedInPlace: { "@type": "State", name: "Kansas" } },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How is pool supply pricing so low?",
      acceptedAnswer: { "@type": "Answer", text: "We buy directly from Pool Corp at contractor pricing — the same distributor professionals use. We pass those savings on to you with a small markup, and delivery is included in the price." },
    },
    {
      "@type": "Question",
      name: "Where do you deliver pool supplies?",
      acceptedAnswer: { "@type": "Answer", text: "We cover the entire Kansas City metro — Independence, Lee's Summit, Blue Springs, Overland Park, Lenexa, and everywhere in between." },
    },
    {
      "@type": "Question",
      name: "How fast is pool supply delivery?",
      acceptedAnswer: { "@type": "Answer", text: "Most orders placed before noon are delivered same-day. Afternoon orders typically arrive next morning. We'll text you a delivery window." },
    },
    {
      "@type": "Question",
      name: "Do I need a membership for pool supplies?",
      acceptedAnswer: { "@type": "Answer", text: "No memberships, no subscriptions, no accounts. Just browse, add to cart, and check out. Pay with any credit or debit card." },
    },
    {
      "@type": "Question",
      name: "Can I order pool supplies not listed?",
      acceptedAnswer: { "@type": "Answer", text: "Absolutely. We have access to Pool Corp's full catalog. Email or call with what you need and we'll get you a quote." },
    },
  ],
};

export default function PoolsPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <PoolsHero />

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
        <div className="pools-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <PoolsHowItWorks />
        </div>
        <div className="pools-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <PoolsProducts />
        </div>
        <div className="pools-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <PoolsSavings />
        </div>
        <div className="pools-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <PoolsServiceArea />
        </div>
        <div className="pools-enter" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
          <PoolsFaq />
        </div>
      </div>
    </main>
  );
}
