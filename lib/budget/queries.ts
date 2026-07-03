import { prisma } from "@/lib/prisma";
import { periodWindow, type Period } from "./format";

export type CategoryState = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  monthlyLimitCents: number;
  spentCents: number;
  remainingCents: number;
  pctUsed: number;
  sortOrder: number;
};

export async function getCategoryStates(
  userId: string,
  period: Period = "month",
): Promise<CategoryState[]> {
  const { from, to } = periodWindow(period);

  const categories = await prisma.budgetCategory.findMany({
    where: { userId, archived: false },
    orderBy: { sortOrder: "asc" },
  });

  const grouped = await prisma.budgetEntry.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      occurredAt: { gte: from, lte: to },
      amountCents: { lt: 0 },
    },
    _sum: { amountCents: true },
  });

  const spentByCategory = new Map<string | null, number>();
  for (const g of grouped) {
    spentByCategory.set(g.categoryId, Math.abs(g._sum.amountCents ?? 0));
  }

  return categories.map((c) => {
    const spent = spentByCategory.get(c.id) ?? 0;
    const remaining = c.monthlyLimitCents - spent;
    const pct = c.monthlyLimitCents > 0 ? (spent / c.monthlyLimitCents) * 100 : 0;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      color: c.color,
      icon: c.icon,
      monthlyLimitCents: c.monthlyLimitCents,
      spentCents: spent,
      remainingCents: remaining,
      pctUsed: Math.min(999, pct),
      sortOrder: c.sortOrder,
    };
  });
}

export async function getRecentEntries(userId: string, limit = 20) {
  return prisma.budgetEntry.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: {
      category: {
        select: { id: true, name: true, slug: true, color: true, icon: true },
      },
    },
  });
}

export async function getMonthHero(userId: string) {
  const states = await getCategoryStates(userId, "month");
  const totalLimit = states.reduce((s, c) => s + c.monthlyLimitCents, 0);
  const totalSpent = states.reduce((s, c) => s + c.spentCents, 0);
  const totalRemaining = totalLimit - totalSpent;
  const pct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return {
    monthName,
    totalLimitCents: totalLimit,
    totalSpentCents: totalSpent,
    totalRemainingCents: totalRemaining,
    pctUsed: Math.min(999, pct),
  };
}
