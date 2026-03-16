import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Active listings per platform
  const listings = await prisma.platformListing.groupBy({
    by: ["platform"],
    where: { status: "active" },
    _count: true,
    _avg: { price: true },
  });

  // Sales per platform
  const sales = await prisma.shopSale.findMany({
    where: { soldAt: { gte: since } },
  });

  const platformStats = new Map<string, {
    activeListings: number;
    avgListPrice: number;
    salesCount: number;
    revenue: number;
    profit: number;
    avgSalePrice: number;
  }>();

  // Populate from listings
  for (const l of listings) {
    platformStats.set(l.platform, {
      activeListings: l._count,
      avgListPrice: Math.round((l._avg.price || 0) * 100) / 100,
      salesCount: 0,
      revenue: 0,
      profit: 0,
      avgSalePrice: 0,
    });
  }

  // Populate from sales
  for (const sale of sales) {
    const existing = platformStats.get(sale.platform) || {
      activeListings: 0,
      avgListPrice: 0,
      salesCount: 0,
      revenue: 0,
      profit: 0,
      avgSalePrice: 0,
    };
    existing.salesCount += 1;
    existing.revenue += sale.salePrice;
    existing.profit += sale.netProfit || 0;
    platformStats.set(sale.platform, existing);
  }

  // Calculate averages
  const platforms = Array.from(platformStats.entries()).map(([platform, stats]) => ({
    platform,
    ...stats,
    revenue: Math.round(stats.revenue * 100) / 100,
    profit: Math.round(stats.profit * 100) / 100,
    avgSalePrice: stats.salesCount > 0
      ? Math.round((stats.revenue / stats.salesCount) * 100) / 100
      : 0,
  }));

  return NextResponse.json(platforms);
}
