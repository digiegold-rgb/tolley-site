import { requireFoodAccess } from "@/lib/food/auth";
import FoodCompareTable from "@/components/food/food-compare-table";

export const dynamic = "force-dynamic";

export default async function FoodComparePage() {
  await requireFoodAccess({ callbackUrl: "/food/compare" });

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div className="food-enter" style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.375rem" }}>
          Walmart vs Sam&apos;s Club
        </h1>
        <p style={{ color: "var(--food-text-secondary)", fontSize: "0.9375rem" }}>
          Side-by-side prices on stuff you actually buy. Updated every time you sync.
        </p>
      </div>
      <FoodCompareTable />
    </div>
  );
}
