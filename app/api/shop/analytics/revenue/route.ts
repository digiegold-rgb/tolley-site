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

  const sales = await prisma.shopSale.findMany({
    where: { soldAt: { gte: since } },
    orderBy: { soldAt: "asc" },
  });

  // Group by day
  const dailyMap = new Map<string, { revenue: number; profit: number; count: number }>();
  for (const sale of sales) {
    const day = sale.soldAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(day) || { revenue: 0, profit: 0, count: 0 };
    existing.revenue += sale.salePrice;
    existing.profit += sale.netProfit || 0;
    existing.count += 1;
    dailyMap.set(day, existing);
  }

  // Fill in missing days
  const daily = [];
  const d = new Date(since);
  while (d <= new Date()) {
    const key = d.toISOString().slice(0, 10);
    const data = dailyMap.get(key) || { revenue: 0, profit: 0, count: 0 };
    daily.push({
      date: key,
      revenue: Math.round(data.revenue * 100) / 100,
      profit: Math.round(data.profit * 100) / 100,
      count: data.count,
    });
    d.setDate(d.getDate() + 1);
  }

  // Group by platform
  const platformMap = new Map<string, { revenue: number; profit: number; count: number }>();
  for (const sale of sales) {
    const existing = platformMap.get(sale.platform) || { revenue: 0, profit: 0, count: 0 };
    existing.revenue += sale.salePrice;
    existing.profit += sale.netProfit || 0;
    existing.count += 1;
    platformMap.set(sale.platform, existing);
  }

  const byPlatform = Array.from(platformMap.entries()).map(([platform, data]) => ({
    platform,
    revenue: Math.round(data.revenue * 100) / 100,
    profit: Math.round(data.profit * 100) / 100,
    count: data.count,
  }));

  return NextResponse.json({ daily, byPlatform });
}
