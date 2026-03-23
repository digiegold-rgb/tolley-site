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
  const year = searchParams.get("year") || String(new Date().getFullYear());

  const dateFrom = from ? new Date(from) : new Date(`${year}-01-01`);
  const dateTo = to ? new Date(to) : new Date(`${year}-12-31`);

  // Get all transactions with tax categories
  const transactions = await prisma.ledgerTransaction.findMany({
    where: {
      date: { gte: dateFrom, lte: dateTo },
      taxCategory: { not: null },
    },
    select: {
      taxCategory: true,
      irsLine: true,
      amount: true,
      type: true,
      description: true,
      date: true,
    },
    orderBy: { date: "desc" },
  });

  // Group by tax category
  const catMap: Record<string, { irsLine: string; total: number; count: number; deductible: boolean }> = {};
  for (const tx of transactions) {
    const cat = tx.taxCategory!;
    if (!catMap[cat]) {
      const deductible = tx.irsLine !== "none" && cat !== "Personal" && cat !== "Transfer";
      catMap[cat] = { irsLine: tx.irsLine || "none", total: 0, count: 0, deductible };
    }
    catMap[cat].total += tx.amount;
    catMap[cat].count++;
  }

  const categories = Object.entries(catMap)
    .map(([category, data]) => ({ category, ...data, total: Math.round(data.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  const totalDeductible = categories
    .filter((c) => c.deductible)
    .reduce((s, c) => s + c.total, 0);

  const totalRevenue = categories
    .filter((c) => c.category === "Revenue")
    .reduce((s, c) => s + c.total, 0);

  const totalExpenses = categories
    .filter((c) => c.deductible && c.category !== "Revenue")
    .reduce((s, c) => s + c.total, 0);

  return NextResponse.json({
    year,
    period: { from: dateFrom.toISOString().split("T")[0], to: dateTo.toISOString().split("T")[0] },
    categories,
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDeductibleExpenses: Math.round(totalExpenses * 100) / 100,
      estimatedTaxableIncome: Math.round((totalRevenue - totalExpenses) * 100) / 100,
      totalTransactions: transactions.length,
    },
  });
}
