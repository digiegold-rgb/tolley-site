import { discoveryMetadata } from "@/lib/discovery";
import Link from "next/link";
import { SellerConsult } from "@/components/homes/seller-consult";
import { HOMES_FAQ, HM_SERVICE_AREAS, HM_SELLER_DESCRIPTION } from "@/lib/homes";
import { PublicOfferDetails } from "@/components/shared/public-offer-details";
import { HomesHero } from "@/components/homes/homes-hero";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { HomesAgent } from "@/components/homes/homes-agent";
import { HomesServices } from "@/components/homes/homes-services";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "Jared Tolley — Your KC Homes LLC",
  description: HM_SELLER_DESCRIPTION,
  url: "https://www.tolley.io/homes",
  telephone: "913-283-3826",
  email: "Jared@yourkchomes.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Independence",
    addressRegion: "MO",
    addressCountry: "US",
  },
  areaServed: HM_SERVICE_AREAS.map(name => ({ "@type": "City", name })),
  memberOf: {
    "@type": "Organization",
    name: "United Real Estate Kansas City",
  },
};


function HomesPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <HomesHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <section className="space-y-5 text-slate-200">
          <h2 className="text-3xl font-bold text-white">A clear plan from the first conversation to closing</h2>
          <div className="grid gap-4 md:grid-cols-3">{[
            ["1. Price & plan", "Discuss your goals, timing, property condition and local comparable sales. Decide what preparation makes sense before listing."],
            ["2. Prepare & market", "Set a listing strategy, prepare the property and coordinate marketing and showings. Get help with the belongings if you need it."],
            ["3. Negotiate & close", "Review offers, negotiate terms and work through inspections, deadlines and closing with a local agent."]
          ].map(([title, body]) => <div className="rounded-xl border border-sky-800/40 bg-sky-950/20 p-5" key={title}><h3 className="text-lg font-bold text-white">{title}</h3><p className="mt-2 leading-relaxed">{body}</p></div>)}</div>
          <h2 className="pt-4 text-2xl font-bold text-white">Selling after an inheritance, downsizing or a move?</h2>
          <p className="max-w-3xl leading-relaxed">The house and its contents can need different plans. Jared can help you prepare to sell and coordinate <Link className="text-sky-300 underline" href="/cleanouts">Tolley Cleanouts</Link> or <Link className="text-sky-300 underline" href="/estate">an estate sale</Link> when useful. Cleanout and estate-sale work is separately scoped and quoted; it is not automatically included in real estate representation.</p>
          <p className="text-sm text-slate-400">Serving {HM_SERVICE_AREAS.join(", ")} and the surrounding Kansas City metro in Missouri and Kansas. Confirm property location and needs with Jared.</p>
        </section>
        <SellerConsult />
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
              {HOMES_FAQ.map((item) => (
                <div key={item.q} className="rounded-xl border border-sky-800/30 bg-sky-950/30 p-5">
                  <h3 className="font-semibold text-white">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.a}</p>
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

export const metadata = discoveryMetadata("homes");

export default function PublicLanding() {
  return <><HomesPage /><PublicOfferDetails name="homes" /></>;
}
