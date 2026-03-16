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

  const [
    totalProducts,
    activeListings,
    draftProducts,
    soldProducts,
    sales,
    recentSales,
    lotCount,
    lots,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.platformListing.count({ where: { status: "active" } }),
    prisma.product.count({ where: { status: "draft" } }),
    prisma.product.count({ where: { status: "sold", soldAt: { gte: since } } }),
    prisma.shopSale.findMany({ where: { soldAt: { gte: since } } }),
    prisma.shopSale.findMany({
      where: { soldAt: { gte: since } },
      orderBy: { soldAt: "desc" },
      take: 10,
      include: { product: { select: { id: true, title: true, imageUrls: true } } },
    }),
    prisma.sourceLot.count(),
    prisma.sourceLot.findMany({ where: { status: { not: "complete" } } }),
  ]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.salePrice, 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.netProfit || 0), 0);
  const totalCogs = sales.reduce((sum, s) => sum + (s.cogs || 0), 0);
  const totalFees = sales.reduce((sum, s) => sum + (s.platformFees || 0), 0);
  const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0;

  // Best performers
  const topSales = [...sales]
    .sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0))
    .slice(0, 5);

  // Worst performers
  const worstSales = [...sales]
    .filter((s) => s.netProfit !== null)
    .sort((a, b) => (a.netProfit || 0) - (b.netProfit || 0))
    .slice(0, 5);

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    overview: {
      totalProducts,
      activeListings,
      draftProducts,
      soldThisPeriod: soldProducts,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalCogs: Math.round(totalCogs * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      avgMargin,
      lotCount,
      activeLots: lots.length,
    },
    recentSales,
    topSales,
    worstSales,
  });
}
