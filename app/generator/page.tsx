import { GeneratorHero } from "@/components/generator/generator-hero";
import { GeneratorGallery } from "@/components/generator/generator-gallery";
import { GeneratorUses } from "@/components/generator/generator-uses";
import { GeneratorSpecs } from "@/components/generator/generator-specs";
import { GeneratorCrossSell } from "@/components/generator/generator-cross-sell";
import { GeneratorFaq } from "@/components/generator/generator-faq";

export default function GeneratorPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <GeneratorHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="generator-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <GeneratorGallery />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <GeneratorUses />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <GeneratorSpecs />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <GeneratorCrossSell />
        </div>
        <div className="generator-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <GeneratorFaq />
        </div>
      </div>
    </main>
  );
}
