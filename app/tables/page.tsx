import { TablesHero } from "@/components/tables/tables-hero";
import { TablesGallery } from "@/components/tables/tables-gallery";
import { TablesInventory } from "@/components/tables/tables-inventory";
import { TablesPricing } from "@/components/tables/tables-pricing";
import { TablesCrossSell } from "@/components/tables/tables-cross-sell";
import { TablesFaq } from "@/components/tables/tables-faq";

export default function TablesPage() {
  return (
    <main className="relative z-10 min-h-screen">
      <TablesHero />

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-14 sm:px-8 sm:py-18">
        <div className="tables-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <TablesGallery />
        </div>
        <div className="tables-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <TablesInventory />
        </div>
        <div className="tables-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <TablesPricing />
        </div>
        <div className="tables-enter" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
          <TablesCrossSell />
        </div>
        <div className="tables-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
          <TablesFaq />
        </div>
      </div>
    </main>
  );
}
