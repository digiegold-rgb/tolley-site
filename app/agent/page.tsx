import { PublicOfferDetails } from "@/components/shared/public-offer-details";
import type { Metadata } from "next";
import { StructuredData, tAgentSoftwareSchema } from "@/components/seo/structured-data";
import Link from "next/link";
import { auth } from "@/auth";
import { HpNavbar } from "@/components/homepage/hp-navbar";
import { HpHero } from "@/components/homepage/hp-hero";
import { HpCircleBand } from "@/components/homepage/hp-circle-band";
import { HpSocialProof } from "@/components/homepage/hp-social-proof";
import { HpFeatures } from "@/components/homepage/hp-features";
import { HpHowItWorks } from "@/components/homepage/hp-how-it-works";
import { HpDemo } from "@/components/homepage/hp-demo";
import { HpPricing } from "@/components/homepage/hp-pricing";
import { HpFaq } from "@/components/homepage/hp-faq";
import { HpCta } from "@/components/homepage/hp-cta";
import { HpNewsletter } from "@/components/homepage/hp-newsletter";
import { HpFooter } from "@/components/homepage/hp-footer";

/* auth() reads a Prisma session; keep this page out of static generation. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "T-Agent | Real Estate Lead Intelligence",
  description: "Explore T-Agent lead research, property dossiers, scoring and follow-up tools for real estate agents. Compare plans and see how it works.",
  alternates: { canonical: "https://www.tolley.io/agent" },
  openGraph: { title: "T-Agent | Real Estate Lead Intelligence", description: "Lead research, property dossiers and follow-up tools for real estate agents.", url: "https://www.tolley.io/agent", type: "website" },
};

export default async function AgentHome() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <main className="homepage portal-shell ambient-noise relative min-h-screen overflow-hidden">
      <StructuredData data={tAgentSoftwareSchema} id="ld-t-agent" />
      <HpNavbar isAuthenticated={isAuthenticated} />
      <HpHero />
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-6">
        <Link href="/agent/calculator" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200/25 bg-teal-300/10 px-6 py-5 text-white">
          <span><span className="block text-xs font-semibold uppercase tracking-widest text-teal-200">Free client tool</span><span className="mt-2 block text-lg">A home payment your clients can understand.</span><span className="mt-1 block text-sm text-white/70">Conventional, FHA, VA and USDA. Move a slider, see the full payment.</span></span>
          <span className="text-sm font-semibold text-teal-200">Open mortgage calculator →</span>
        </Link>
      </div>
      <HpCircleBand />
      <HpSocialProof />
      <HpFeatures />
      <HpHowItWorks />
      <HpDemo />
      <HpPricing />
      <HpNewsletter />
      <HpFaq />
      <HpCta />
      <HpFooter />
      <div className="site-legal-footer relative z-10 flex items-center justify-center px-4 py-6">
        <nav
          aria-label="Legal links"
          className="rounded-full border border-white/18 bg-black/35 px-4 py-2 backdrop-blur-xl"
        >
          <ul className="flex flex-wrap justify-center items-center gap-4 text-[0.7rem] tracking-[0.08em] text-white/72 uppercase">
            <li>
              <Link className="font-semibold text-orange-300 transition hover:text-orange-200" href="/start">
                Explore Tolley.io →
              </Link>
            </li>
            <li aria-hidden="true" className="text-white/45">
              |
            </li>
            <li>
              <Link className="transition hover:text-white" href="/privacy">
                Privacy Policy
              </Link>
            </li>
            <li aria-hidden="true" className="text-white/45">
              |
            </li>
            <li>
              <Link className="transition hover:text-white" href="/terms">
                Terms &amp; Conditions
              </Link>
            </li>
            <li aria-hidden="true" className="text-white/45">
              |
            </li>
            <li>
              <Link className="transition hover:text-white" href="/wd">
                Wash &amp; Dry Rental
              </Link>
            </li>
            <li aria-hidden="true" className="text-white/45">
              |
            </li>
            <li>
              <Link className="transition hover:text-white" href="/trailer">
                Trailer Rental
              </Link>
            </li>
            <li aria-hidden="true" className="text-white/45">
              |
            </li>
            <li>
              <Link className="transition hover:text-white" href="/generator">
                Generator Rental
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <PublicOfferDetails name="agent" />
    </main>
  );
}
