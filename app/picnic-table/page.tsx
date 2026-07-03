import { PicnicHero } from "@/components/picnic-table/picnic-hero";
import { PicnicGallery } from "@/components/picnic-table/picnic-gallery";
import { PicnicPricing } from "@/components/picnic-table/picnic-pricing";
import { PicnicCrossSell } from "@/components/picnic-table/picnic-cross-sell";
import { PicnicFaq } from "@/components/picnic-table/picnic-faq";

export default function PicnicTablePage() {
  return (
    <main className="relative z-10 min-h-screen">
      <PicnicHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="picnic-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <PicnicGallery />
        </div>
        <div className="picnic-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <PicnicPricing />
        </div>
        <div className="picnic-enter" style={{ "--enter-delay": "0.25s" } as React.CSSProperties}>
          <PicnicCrossSell />
        </div>
        <div className="picnic-enter" style={{ "--enter-delay": "0.35s" } as React.CSSProperties}>
          <PicnicFaq />
        </div>
      </div>
    </main>
  );
}
