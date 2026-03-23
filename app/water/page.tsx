import { validateShopAdmin } from "@/lib/shop-auth";
import { prisma } from "@/lib/prisma";
import { WaterNav } from "@/components/water/water-nav";
import { WaterDashboard } from "@/components/water/water-dashboard";
import { WaterPinGate } from "./pin-gate";

export const dynamic = "force-dynamic";

export default async function WaterPage() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) return <WaterPinGate />;

  const currentYear = new Date().getFullYear();

  const [latestReading, recentReadings, seasonCostAgg, allInventory] = await Promise.all([
    prisma.waterReading.findFirst({ orderBy: { readingAt: "desc" } }),
    prisma.waterReading.findMany({ orderBy: { readingAt: "desc" }, take: 60 }),
    prisma.poolCost.aggregate({ _sum: { amount: true }, where: { season: currentYear } }),
    prisma.poolInventory.findMany(),
  ]);

  const lowStock = allInventory.filter((i) => i.quantity <= i.lowStockThreshold);
  const seasonCosts = seasonCostAgg._sum.amount || 0;

  return (
    <>
      <WaterNav />
      <WaterDashboard
        latestReading={latestReading ? JSON.parse(JSON.stringify(latestReading)) : null}
        recentReadings={JSON.parse(JSON.stringify(recentReadings))}
        seasonCosts={seasonCosts}
        lowStockItems={JSON.parse(JSON.stringify(lowStock))}
      />
    </>
  );
}
