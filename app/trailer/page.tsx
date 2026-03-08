import { TrailerHero } from "@/components/trailer/trailer-hero";
import { TrailerFleet } from "@/components/trailer/trailer-fleet";
import { TrailerHowItWorks } from "@/components/trailer/trailer-how-it-works";
import { TrailerInfo } from "@/components/trailer/trailer-info";
import { TrailerFaq } from "@/components/trailer/trailer-faq";

export default function TrailerPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <TrailerHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="trailer-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <TrailerFleet />
        </div>
        <div className="trailer-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <TrailerHowItWorks />
        </div>
        <div className="trailer-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <TrailerInfo />
        </div>
        <div className="trailer-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <TrailerFaq />
        </div>
      </div>
    </main>
  );
}
