import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { VIDEO_TIERS } from "@/lib/video";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [generations, dailyRaw] = await Promise.all([
    prisma.videoGeneration.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        status: true,
        tier: true,
        model: true,
        creditsUsed: true,
        costCents: true,
        createdAt: true,
      },
    }),
    prisma.$queryRaw<{ date: string; count: bigint; credits: bigint }[]>`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
        COUNT(*)::bigint as count,
        COALESCE(SUM("creditsUsed"), 0)::bigint as credits
      FROM "VideoGeneration"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `,
  ]);

  const completed = generations.filter((g) => g.status === "completed");
  const failed = generations.filter((g) => g.status === "failed");
  const totalCreditsUsed = generations.reduce((sum, g) => sum + g.creditsUsed, 0);
  const totalCostCents = completed.reduce((sum, g) => sum + g.costCents, 0);

  // Calculate revenue based on tier pricing
  const totalRevenueCents = completed.reduce((sum, g) => {
    const tierConfig = VIDEO_TIERS.find((t) => t.id === g.tier);
    return sum + (tierConfig?.priceCents ?? 0);
  }, 0);

  // By tier
  const tierMap = new Map<string, { count: number; credits: number; costCents: number }>();
  for (const g of generations) {
    const entry = tierMap.get(g.tier) || { count: 0, credits: 0, costCents: 0 };
    entry.count++;
    entry.credits += g.creditsUsed;
    if (g.status === "completed") entry.costCents += g.costCents;
    tierMap.set(g.tier, entry);
  }

  // By model
  const modelMap = new Map<string, number>();
  for (const g of generations) {
    modelMap.set(g.model, (modelMap.get(g.model) || 0) + 1);
  }

  return NextResponse.json({
    totalGenerations: generations.length,
    completedGenerations: completed.length,
    failedGenerations: failed.length,
    totalCreditsUsed,
    totalCostCents,
    totalRevenueCents,
    byTier: Array.from(tierMap.entries()).map(([tier, data]) => ({ tier, ...data })),
    byModel: Array.from(modelMap.entries()).map(([model, count]) => ({ model, count })),
    daily: dailyRaw.map((d) => ({
      date: d.date,
      count: Number(d.count),
      credits: Number(d.credits),
    })),
  });
}
