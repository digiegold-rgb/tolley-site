import { HomesHero } from "@/components/homes/homes-hero";
import { HomesAgent } from "@/components/homes/homes-agent";
import { HomesServices } from "@/components/homes/homes-services";

export default function HomesPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <HomesHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="homes-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <HomesAgent />
        </div>
        <div className="homes-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <HomesServices />
        </div>
      </div>
    </main>
  );
}
