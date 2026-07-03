import { VaterHubHero } from "@/components/vater/vater-hub-hero";
import { VaterHubCards } from "@/components/vater/vater-hub-cards";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Vater Ventures",
  description: "Five AI-powered passive-income businesses: dropshipping, print-on-demand, government contracts, faceless YouTube, and digital courses.",
  url: "https://www.tolley.io/vater",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Passive Income Businesses",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "AI Dropshipping" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Print on Demand" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Government Contracts (GovBids)" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Faceless YouTube Channel" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Digital Courses" } },
    ],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Vater Ventures?",
      acceptedAnswer: { "@type": "Answer", text: "Vater Ventures is a collection of five AI-powered passive-income businesses designed around a clear system: dropshipping, print-on-demand merch, government contract bidding, faceless YouTube, and digital course sales." },
    },
    {
      "@type": "Question",
      name: "How does AI dropshipping work at Vater Ventures?",
      acceptedAnswer: { "@type": "Answer", text: "AI tools automate product research, supplier sourcing, listing creation, and order routing — reducing manual work and scaling faster than traditional dropshipping." },
    },
    {
      "@type": "Question",
      name: "What is GovBids?",
      acceptedAnswer: { "@type": "Answer", text: "GovBids is Vater's government contracting runway — identifying and bidding on small business set-aside contracts using AI to find and submit proposals efficiently." },
    },
    {
      "@type": "Question",
      name: "Can I start a faceless YouTube channel without showing my face?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Faceless YouTube channels use AI-generated voiceovers, stock footage, and automated editing to create content without appearing on camera." },
    },
    {
      "@type": "Question",
      name: "What kinds of digital courses does Vater Ventures offer?",
      acceptedAnswer: { "@type": "Answer", text: "Digital courses cover AI-powered business systems including dropshipping setup, print-on-demand workflows, government contracting basics, and YouTube automation strategies." },
    },
  ],
};

export default function VaterPage() {
  return (
    <main>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      <VaterHubHero />
      <VaterHubCards />

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqJsonLd.mainEntity.map((item) => (
            <div key={item.name} className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-5">
              <h3 className="font-bold text-white">{item.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.acceptedAnswer.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
