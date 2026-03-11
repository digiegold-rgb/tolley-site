import { LmCta } from "@/components/lastmile/lm-cta";
import { LmFleet } from "@/components/lastmile/lm-fleet";
import { LmGallery } from "@/components/lastmile/lm-gallery";
import { LmHero } from "@/components/lastmile/lm-hero";
import { LmServices } from "@/components/lastmile/lm-services";
import { LmWhy } from "@/components/lastmile/lm-why";

export default function LastmilePage() {
  return (
    <main className="relative z-10 min-h-screen">
      <LmHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="lm-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <LmFleet />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <LmServices />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <LmWhy />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <LmGallery />
        </div>

        <div className="lm-enter" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
          <LmCta />
        </div>
      </div>
    </main>
  );
}
