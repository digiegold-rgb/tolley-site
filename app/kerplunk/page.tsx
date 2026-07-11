import { KerplunkHero } from "@/components/kerplunk/kerplunk-hero";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { KerplunkGallery } from "@/components/kerplunk/kerplunk-gallery";
import { KerplunkPricing } from "@/components/kerplunk/kerplunk-pricing";
import { KerplunkCrossSell } from "@/components/kerplunk/kerplunk-cross-sell";
import { KerplunkFaq } from "@/components/kerplunk/kerplunk-faq";

export default function KerplunkPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <KerplunkHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="kerplunk-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <KerplunkGallery />
        </div>
        <div className="kerplunk-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <KerplunkPricing />
        </div>
        <div className="kerplunk-enter" style={{ "--enter-delay": "0.25s" } as React.CSSProperties}>
          <KerplunkCrossSell />
        </div>
        <div className="kerplunk-enter" style={{ "--enter-delay": "0.35s" } as React.CSSProperties}>
          <KerplunkFaq />
        </div>
      </div>
      <MoreFromTolley currentSubsite="kerplunk" />
    </main>
  );
}
