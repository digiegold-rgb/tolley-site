// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const range = sp.get("range") || "3months";
  const now = new Date();
  let start: Date;
  if (range === "week") start = new Date(now.getTime() - 7 * 86400000);
  else if (range === "month") start = new Date(now.getTime() - 30 * 86400000);
  else if (range === "all") start = new Date("2020-01-01");
  else start = new Date(now.getTime() - 90 * 86400000);

  try {
    // Get receipts for spending over time
    const receipts = await prisma.foodReceipt.findMany({
      where: {
        householdId: household.id,
        purchaseDate: { gte: start, lte: now },
        total: { not: null },
      },
      orderBy: { purchaseDate: "asc" },
    });

    const spending = receipts.map((r) => ({
      period: r.purchaseDate?.toISOString().split("T")[0] || "Unknown",
      amount: r.total || 0,
      store: r.store || "Unknown",
    }));

    // Top expenses by item
    const priceEntries = await prisma.foodPriceEntry.findMany({
      where: { householdId: household.id, purchaseDate: { gte: start } },
    });

    const itemTotals = new Map<string, { total: number; count: number }>();
    for (const e of priceEntries) {
      const name = e.itemName;
      const existing = itemTotals.get(name) || { total: 0, count: 0 };
      existing.total += e.price;
      existing.count += 1;
      itemTotals.set(name, existing);
    }

    const topExpenses = Array.from(itemTotals.entries())
      .map(([name, data]) => ({
        name,
        totalSpent: Math.round(data.total * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 15);

    // Store breakdown
    const storeTotals = new Map<string, { total: number; visits: number }>();
    for (const r of receipts) {
      const store = r.store || "Unknown";
      const existing = storeTotals.get(store) || { total: 0, visits: 0 };
      existing.total += r.total || 0;
      existing.visits += 1;
      storeTotals.set(store, existing);
    }

    const storeBreakdown = Array.from(storeTotals.entries())
      .map(([store, data]) => ({
        store,
        total: Math.round(data.total * 100) / 100,
        visits: data.visits,
      }))
      .sort((a, b) => b.total - a.total);

    const totalSpent = receipts.reduce((sum, r) => sum + (r.total || 0), 0);

    return NextResponse.json({
      spending,
      topExpenses,
      storeBreakdown,
      totalSpent: Math.round(totalSpent * 100) / 100,
    });
  } catch (err) {
    console.error("[Food] Spending analytics error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
