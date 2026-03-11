import { HvacHero } from "@/components/hvac/hvac-hero";
import { HvacServices } from "@/components/hvac/hvac-services";
import { HvacAbout } from "@/components/hvac/hvac-about";
import { HvacGallery } from "@/components/hvac/hvac-gallery";
import { HvacReviews } from "@/components/hvac/hvac-reviews";
import { HvacCta } from "@/components/hvac/hvac-cta";

export default function HvacPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <HvacHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="hvac-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <HvacServices />
        </div>
        <div className="hvac-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <HvacAbout />
        </div>
        <div className="hvac-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <HvacGallery />
        </div>
      </div>

      {/* Reviews — full width, outside max-w container */}
      <div className="hvac-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
        <HvacReviews />
      </div>

      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
        <div className="hvac-enter" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
          <HvacCta />
        </div>
      </div>
    </main>
  );
}
