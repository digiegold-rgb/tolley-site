import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { applyInsight, dismissInsight } from "@/lib/pools-intelligence";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [products, insights, engagementCounts, lastRunSnapshot] = await Promise.all([
    prisma.poolProduct.findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        brand: true,
        price: true,
        costPrice: true,
        retailPrice: true,
        stockStatus: true,
        stockQty: true,
      },
    }),
    prisma.poolInsight.findMany({
      where: { status: { in: ["new", "auto_applied"] } },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.poolProductEvent.groupBy({
      by: ["sku"],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    prisma.poolStockSnapshot.findFirst({
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    }),
  ]);

  // ─── Per-product margin data ───
  const engagementMap = Object.fromEntries(
    engagementCounts.map((e) => [e.sku, e._count.id]),
  );

  const perProduct = products.map((p) => {
    const marginDollar = p.costPrice != null ? p.price - p.costPrice : null;
    const marginPct =
      p.costPrice != null && p.costPrice > 0
        ? Math.round(((p.price - p.costPrice) / p.price) * 100)
        : null;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      brand: p.brand,
      cost: p.costPrice,
      sell: p.price,
      retail: p.retailPrice,
      marginDollar,
      marginPct,
      stockStatus: p.stockStatus,
      stockQty: p.stockQty,
      engagement: engagementMap[p.sku] || 0,
    };
  });

  // ─── Overview ───
  const withCost = perProduct.filter((p) => p.cost != null);
  const totalMargin = withCost.reduce((s, p) => s + (p.marginDollar || 0), 0);
  const avgMarginPct =
    withCost.length > 0
      ? Math.round(withCost.reduce((s, p) => s + (p.marginPct || 0), 0) / withCost.length)
      : 0;
  const inventoryValue = products.reduce(
    (s, p) => s + (p.costPrice || 0) * (p.stockQty || 0),
    0,
  );
  const oosCount = products.filter((p) => p.stockStatus === "out-of-stock").length;
  const totalEngagement = Object.values(engagementMap).reduce((a, b) => a + b, 0);

  // ─── By Brand ───
  const brandMap: Record<string, { totalMargin: number; totalPct: number; count: number }> = {};
  for (const p of withCost) {
    const b = p.brand || "Unknown";
    if (!brandMap[b]) brandMap[b] = { totalMargin: 0, totalPct: 0, count: 0 };
    brandMap[b].totalMargin += p.marginDollar || 0;
    brandMap[b].totalPct += p.marginPct || 0;
    brandMap[b].count++;
  }
  const byBrand = Object.entries(brandMap)
    .map(([name, d]) => ({
      name,
      avgMarginPct: Math.round(d.totalPct / d.count),
      totalMargin: Math.round(d.totalMargin * 100) / 100,
      count: d.count,
    }))
    .sort((a, b) => b.totalMargin - a.totalMargin);

  // ─── By Category ───
  const catMap: Record<string, { totalMargin: number; totalPct: number; count: number }> = {};
  for (const p of withCost) {
    const c = p.category || "Uncategorized";
    if (!catMap[c]) catMap[c] = { totalMargin: 0, totalPct: 0, count: 0 };
    catMap[c].totalMargin += p.marginDollar || 0;
    catMap[c].totalPct += p.marginPct || 0;
    catMap[c].count++;
  }
  const byCategory = Object.entries(catMap)
    .map(([name, d]) => ({
      name,
      avgMarginPct: Math.round(d.totalPct / d.count),
      totalMargin: Math.round(d.totalMargin * 100) / 100,
      count: d.count,
    }))
    .sort((a, b) => b.totalMargin - a.totalMargin);

  // ─── Alerts ───
  const alerts: { type: "low" | "negative" | "missing"; product: string; sku: string; marginPct: number | null }[] = [];
  for (const p of perProduct) {
    if (p.cost == null) {
      alerts.push({ type: "missing", product: p.name, sku: p.sku, marginPct: null });
    } else if (p.marginPct != null && p.marginPct < 0) {
      alerts.push({ type: "negative", product: p.name, sku: p.sku, marginPct: p.marginPct });
    } else if (p.marginPct != null && p.marginPct < 20) {
      alerts.push({ type: "low", product: p.name, sku: p.sku, marginPct: p.marginPct });
    }
  }
  alerts.sort((a, b) => (a.marginPct ?? -999) - (b.marginPct ?? -999));

  // ─── Intelligence insights ───
  const sortedInsights = insights
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const aOrd = severityOrder[a.severity as keyof typeof severityOrder] ?? 3;
      const bOrd = severityOrder[b.severity as keyof typeof severityOrder] ?? 3;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      sku: i.sku,
      title: i.title,
      body: i.body,
      meta: i.meta,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    }));

  return NextResponse.json({
    overview: {
      totalProducts: products.length,
      avgMarginPct,
      totalMargin: Math.round(totalMargin * 100) / 100,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      oosCount,
      missingCost: products.length - withCost.length,
      totalEngagement,
      lastSnapshot: lastRunSnapshot?.capturedAt?.toISOString() || null,
    },
    perProduct: perProduct.sort((a, b) => (b.marginPct ?? -999) - (a.marginPct ?? -999)),
    byBrand,
    byCategory,
    alerts,
    insights: sortedInsights,
  });
}

// POST — apply or dismiss an insight
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, insightId } = body;

  if (!insightId || !["apply", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ok =
    action === "apply"
      ? await applyInsight(insightId)
      : await dismissInsight(insightId);

  return NextResponse.json({ ok });
}
