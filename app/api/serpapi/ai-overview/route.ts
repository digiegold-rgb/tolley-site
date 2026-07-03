import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recent = await prisma.aiOverviewCheck.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Group by keyword — show latest + 7-day history.
  const latestByKeyword = new Map<string, (typeof recent)[number]>();
  const historyByKeyword = new Map<string, typeof recent>();
  for (const row of recent) {
    if (!latestByKeyword.has(row.keyword)) latestByKeyword.set(row.keyword, row);
    if (!historyByKeyword.has(row.keyword)) historyByKeyword.set(row.keyword, []);
    historyByKeyword.get(row.keyword)!.push(row);
  }

  const items = Array.from(latestByKeyword.entries()).map(([keyword, row]) => {
    const history = (historyByKeyword.get(keyword) ?? []).slice(0, 14);
    return {
      keyword,
      hasOverview: row.hasOverview,
      tolleyCited: row.tolleyCited,
      citedDomains: row.citedDomains,
      competitorCount: row.competitorCount,
      overviewText: row.overviewText,
      capturedAt: row.createdAt,
      history: history.map((h) => ({
        date: h.createdAt,
        hasOverview: h.hasOverview,
        tolleyCited: h.tolleyCited,
      })),
    };
  });

  return NextResponse.json({ items });
}
