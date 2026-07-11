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
import { HpTestimonials } from "@/components/homepage/hp-testimonials";
import { HpFaq } from "@/components/homepage/hp-faq";
import { HpCta } from "@/components/homepage/hp-cta";
import { HpNewsletter } from "@/components/homepage/hp-newsletter";
import { HpFooter } from "@/components/homepage/hp-footer";

export default async function Home() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <main className="homepage portal-shell ambient-noise relative min-h-screen overflow-hidden">
      <HpNavbar isAuthenticated={isAuthenticated} />
      <HpHero />
      <HpCircleBand />
      <HpSocialProof />
      <HpFeatures />
      <HpHowItWorks />
      <HpDemo />
      <HpPricing />
      <HpTestimonials />
      <HpNewsletter />
      <HpFaq />
      <HpCta />
      <HpFooter />
      <div className="site-legal-footer fixed inset-x-0 bottom-4 z-40 flex items-center justify-center px-4">
        <nav
          aria-label="Legal links"
          className="rounded-full border border-white/18 bg-black/35 px-4 py-2 backdrop-blur-xl"
        >
          <ul className="flex items-center gap-4 text-[0.7rem] tracking-[0.08em] text-white/72 uppercase">
            <li>
              <Link className="font-semibold text-orange-300 transition hover:text-orange-200" href="/start">
                All 40+ Services →
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
            <li aria-hidden="true" className="text-white/45">
              |
            </li>
            <li>
              <Link className="transition hover:text-white" href="/pools">
                Pool Supplies
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </main>
  );
}
