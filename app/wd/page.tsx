import { WdHero } from "@/components/wd/wd-hero";
import { WdHowItWorks } from "@/components/wd/wd-how-it-works";
import { WdPricing } from "@/components/wd/wd-pricing";
import { WdServiceArea } from "@/components/wd/wd-service-area";
import { WdFaq } from "@/components/wd/wd-faq";

export default function WdPage() {
  return (
    <main className="portal-shell ambient-noise relative min-h-screen overflow-hidden px-5 py-10 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight wd-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight wd-spotlight-right" />

      <section className="relative z-20 mx-auto w-full max-w-6xl space-y-8">
        <WdHero />
        <WdHowItWorks />
        <WdPricing />
        <WdServiceArea />
        <WdFaq />
      </section>
    </main>
  );
}
