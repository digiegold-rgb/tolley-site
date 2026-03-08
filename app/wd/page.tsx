import { WdHero } from "@/components/wd/wd-hero";
import { WdHowItWorks } from "@/components/wd/wd-how-it-works";
import { WdPricing } from "@/components/wd/wd-pricing";
import { WdServiceArea } from "@/components/wd/wd-service-area";
import { WdFaq } from "@/components/wd/wd-faq";

export default function WdPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <WdHero />

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
        <div className="wd-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <WdHowItWorks />
        </div>
        <div className="wd-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <WdPricing />
        </div>
        <div className="wd-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <WdServiceArea />
        </div>
        <div className="wd-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <WdFaq />
        </div>
      </div>
    </main>
  );
}
