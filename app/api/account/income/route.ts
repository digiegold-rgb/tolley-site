// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const check = await requireAdminApiSession();
  if (check instanceof NextResponse) return check;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const period = searchParams.get("period") || "ytd";

  // Calculate date range
  const now = new Date();
  let dateFrom: Date;
  let dateTo = new Date(now);

  if (from) {
    dateFrom = new Date(from);
  } else if (period === "mtd") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "wtd") {
    dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - dateFrom.getDay());
  } else {
    // ytd
    dateFrom = new Date(now.getFullYear(), 0, 1);
  }
  if (to) dateTo = new Date(to);

  // Get income transactions grouped by source
  const transactions = await prisma.ledgerTransaction.findMany({
    where: {
      date: { gte: dateFrom, lte: dateTo },
      incomeSource: { not: null },
    },
    select: {
      incomeSource: true,
      amount: true,
      date: true,
    },
    orderBy: { date: "desc" },
  });

  // Group by source
  const sourceMap: Record<string, { total: number; count: number; mtd: number; wtd: number }> = {};
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  for (const tx of transactions) {
    const src = tx.incomeSource!;
    if (!sourceMap[src]) sourceMap[src] = { total: 0, count: 0, mtd: 0, wtd: 0 };
    sourceMap[src].total += tx.amount;
    sourceMap[src].count++;
    if (tx.date >= monthStart) sourceMap[src].mtd += tx.amount;
    if (tx.date >= weekStart) sourceMap[src].wtd += tx.amount;
  }

  const sources = Object.entries(sourceMap)
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.total - a.total);

  const totalIncome = sources.reduce((s, x) => s + x.total, 0);
  const totalMTD = sources.reduce((s, x) => s + x.mtd, 0);
  const totalWTD = sources.reduce((s, x) => s + x.wtd, 0);

  // Monthly trend (last 6 months)
  const monthlyTrend: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const label = m.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const mTotal = transactions
      .filter((t) => t.date >= m && t.date <= mEnd)
      .reduce((s, t) => s + t.amount, 0);
    monthlyTrend.push({ month: label, total: Math.round(mTotal * 100) / 100 });
  }

  return NextResponse.json({
    period: { from: dateFrom.toISOString().split("T")[0], to: dateTo.toISOString().split("T")[0] },
    sources,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalMTD: Math.round(totalMTD * 100) / 100,
    totalWTD: Math.round(totalWTD * 100) / 100,
    monthlyTrend,
    transactionCount: transactions.length,
  });
}
