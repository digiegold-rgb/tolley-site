import { RentalHero } from "@/components/rental/rental-hero";
import { RentalGrid } from "@/components/rental/rental-grid";

export default function RentalPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <RentalHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="rental-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <RentalGrid />
        </div>
      </div>
    </main>
  );
}
