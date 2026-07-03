import { prisma } from "@/lib/prisma";
import { formatPoolPrice } from "@/lib/pools";

const fallbackComparisons = [
  { name: "Chlorine Tablets 25lb", retail: 129, ours: 89 },
  { name: "Pool Shock 12-Pack", retail: 59, ours: 42 },
  { name: "Variable Speed Pump 1.5HP", retail: 749, ours: 549 },
  { name: "Water Test Kit", retail: 42, ours: 28 },
  { name: "Algaecide 60 Plus", retail: 36, ours: 24 },
  { name: "Vacuum Hose 36ft", retail: 52, ours: 34 },
];

async function getTopSavings() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get products that have competitor price data
    const productsWithCompetitors = await prisma.$queryRaw<
      { name: string; price: number; minCompetitorPrice: number }[]
    >`
      SELECT p.name, p.price,
        (SELECT MIN(cp.price) FROM "CompetitorPrice" cp
         WHERE cp.sku = p.sku AND cp."scannedAt" >= ${sevenDaysAgo}) as "minCompetitorPrice"
      FROM "PoolProduct" p
      WHERE p.status = 'active'
        AND p."retailPrice" IS NOT NULL OR EXISTS (
          SELECT 1 FROM "CompetitorPrice" cp
          WHERE cp.sku = p.sku AND cp."scannedAt" >= ${sevenDaysAgo}
        )
      ORDER BY (
        COALESCE(
          (SELECT MIN(cp.price) FROM "CompetitorPrice" cp
           WHERE cp.sku = p.sku AND cp."scannedAt" >= ${sevenDaysAgo}),
          p."retailPrice"
        ) - p.price
      ) DESC
      LIMIT 6
    `;

    if (productsWithCompetitors.length < 3) return null;

    return productsWithCompetitors
      .filter((p) => p.minCompetitorPrice && p.minCompetitorPrice > p.price)
      .map((p) => ({
        name: p.name,
        retail: Math.round(p.minCompetitorPrice),
        ours: Math.round(p.price),
      }));
  } catch {
    return null;
  }
}

export async function PoolsSavings() {
  const dbSavings = await getTopSavings();
  const comparisons =
    dbSavings && dbSavings.length >= 3 ? dbSavings : fallbackComparisons;

  // Calculate average savings percentage
  const avgSavingsPct =
    comparisons.length > 0
      ? Math.round(
          comparisons.reduce(
            (s, c) => s + ((c.retail - c.ours) / c.retail) * 100,
            0
          ) / comparisons.length
        )
      : 30;

  // Compute an average dollar savings across the comparisons so the hero
  // stat can call it out as "members save an average of $X".
  const avgSavingsDollars =
    comparisons.length > 0
      ? Math.round(
          comparisons.reduce((s, c) => s + (c.retail - c.ours), 0) /
            comparisons.length
        )
      : 0;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-cyan-100/50 sm:p-8">
      <h2 className="text-[1.6rem] font-extrabold text-[#0e7490]">Why Buy From Us?</h2>
      <p className="mt-2 text-sm text-slate-600">
        We buy at contractor pricing from Pool Corp — the same distributor pool
        pros use. You get those savings, delivered.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[rgba(6,182,212,0.2)]">
              <th className="pb-2 font-extrabold text-[#164e63]">Product</th>
              <th className="pb-2 text-right font-semibold text-slate-400">
                Retail
              </th>
              <th className="pb-2 text-right font-extrabold text-[#0e7490]">
                Our Price
              </th>
              <th className="pb-2 text-right font-extrabold text-emerald-600">
                You Save
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((item) => {
              const savings = item.retail - item.ours;
              return (
                <tr
                  key={item.name}
                  className="border-b border-cyan-50 last:border-0"
                >
                  <td className="py-2.5 font-medium text-[#164e63]">
                    {item.name}
                  </td>
                  <td className="py-2.5 text-right text-slate-400 line-through">
                    {formatPoolPrice(item.retail)}
                  </td>
                  <td className="py-2.5 text-right font-extrabold text-[#0e7490]">
                    {formatPoolPrice(item.ours)}
                  </td>
                  <td className="py-2.5 text-right font-extrabold text-emerald-600">
                    {formatPoolPrice(savings)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hero savings callout — per handoff spec */}
      <div className="mt-5 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 p-6 text-center">
        <p className="text-lg font-extrabold text-cyan-900">
          Members save an average of{" "}
          <span className="pools-savings-badge inline-block text-[1.6rem] text-[#0e7490]">
            ${avgSavingsDollars}
          </span>{" "}
          per order
        </p>
        <p className="mt-2 text-sm text-cyan-700/80">
          Save {avgSavingsPct}%+ vs Walmart, Leslie&apos;s, and other big-box
          retailers. Delivery included.
        </p>
      </div>
    </section>
  );
}
