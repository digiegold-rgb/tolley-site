import { HomesHero } from "@/components/homes/homes-hero";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { HomesAgent } from "@/components/homes/homes-agent";
import { HomesServices } from "@/components/homes/homes-services";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "Jared Tolley — Your KC Homes LLC",
  description: "Kansas City real estate agent specializing in buying, selling, and investment properties. Serving Independence, Lee's Summit, Blue Springs, and the KC metro.",
  url: "https://www.tolley.io/homes",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
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
  memberOf: {
    "@type": "Organization",
    name: "United Real Estate Kansas City",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What areas does Jared Tolley serve in Kansas City?",
      acceptedAnswer: { "@type": "Answer", text: "Jared serves the full Kansas City metro including Independence, Lee's Summit, Blue Springs, Raytown, Grandview, and both Kansas City MO and KS." },
    },
    {
      "@type": "Question",
      name: "What real estate services does Your KC Homes LLC offer?",
      acceptedAnswer: { "@type": "Answer", text: "Buyer representation, seller representation, investment property analysis, and relocation services — backed by AI-powered market tools." },
    },
    {
      "@type": "Question",
      name: "Does Your KC Homes LLC help with investment properties?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Jared specializes in analyzing rental properties, fix-and-flip opportunities, and HELOC strategies for the KC metro market." },
    },
    {
      "@type": "Question",
      name: "How do I contact a Kansas City real estate agent?",
      acceptedAnswer: { "@type": "Answer", text: "Call or text 913-283-3826 or email Jared@yourkchomes.com. Jared is affiliated with United Real Estate Kansas City." },
    },
    {
      "@type": "Question",
      name: "What makes Your KC Homes LLC different from other KC real estate agents?",
      acceptedAnswer: { "@type": "Answer", text: "AI-powered tools for market analysis, property valuation, and deal sourcing — plus local Independence MO expertise and a full suite of rental and service businesses to help with your move." },
    },
  ],
};

export default function HomesPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <HomesHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="homes-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <HomesAgent />
        </div>
        <div className="homes-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <HomesServices />
        </div>

        {/* FAQ Section */}
        <div className="homes-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <section className="rounded-2xl border border-sky-800/40 bg-sky-950/20 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">Frequently Asked Questions</h2>
            <div className="mt-4 space-y-4">
              {faqJsonLd.mainEntity.map((item) => (
                <div key={item.name} className="rounded-xl border border-sky-800/30 bg-sky-950/30 p-5">
                  <h3 className="font-semibold text-white">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <MoreFromTolley currentSubsite="homes" />
    </main>
  );
}
