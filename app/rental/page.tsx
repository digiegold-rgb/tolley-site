import { RentalHero } from "@/components/rental/rental-hero";
import { RentalGrid } from "@/components/rental/rental-grid";
import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";

export default function RentalPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <RentalHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="rental-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <RentalGrid />
        </div>

        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 text-center">
          <p className="text-sm font-bold text-white">
            Want something that&apos;s not listed — or first shot when gear frees up?
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Drop your email and I&apos;ll reach out personally.
          </p>
          <EmailCaptureForm
            source="rental"
            ctaText="Keep me posted"
            successMessage="Got it — I'll be in touch."
            className="mx-auto mt-3 max-w-md"
          />
        </div>
      </div>
      <MoreFromTolley currentSubsite="rental" />
    </main>
  );
}
