import { MovingHero } from "@/components/moving/moving-hero";
import { MovingGallery } from "@/components/moving/moving-gallery";
import { MovingBundle } from "@/components/moving/moving-bundle";
import { MovingPricing } from "@/components/moving/moving-pricing";
import { MovingWhy } from "@/components/moving/moving-why";
import { MovingFaq } from "@/components/moving/moving-faq";

export default function MovingPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <MovingHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="moving-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <MovingGallery />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <MovingBundle />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <MovingPricing />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <MovingWhy />
        </div>
        <div className="moving-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <MovingFaq />
        </div>
      </div>
    </main>
  );
}
