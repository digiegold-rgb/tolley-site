/**
 * POST /api/junkinjays — Track page views and phone clicks
 * GET  /api/junkinjays — Analytics dashboard data (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { event, referrer } = body;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;

  if (event === "pageview") {
    await prisma.jjPageView.create({
      data: {
        path: "/junkinjays",
        referrer: referrer || null,
        userAgent,
        ip,
      },
    });
  } else if (event === "phone_click") {
    await prisma.jjPhoneClick.create({
      data: {
        referrer: referrer || null,
        userAgent,
        ip,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalViews,
    views30d,
    views7d,
    views24h,
    totalClicks,
    clicks30d,
    clicks7d,
    clicks24h,
    referrerBreakdown,
    dailyViews,
    dailyClicks,
  ] = await Promise.all([
    prisma.jjPageView.count(),
    prisma.jjPageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.jjPageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.jjPageView.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.jjPhoneClick.count(),
    prisma.jjPhoneClick.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.jjPhoneClick.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.jjPhoneClick.count({ where: { createdAt: { gte: oneDayAgo } } }),
    // Referrer breakdown (top sources)
    prisma.jjPageView.groupBy({
      by: ["referrer"],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    // Daily views (last 30 days) - raw data, aggregate client-side
    prisma.jjPageView.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.jjPhoneClick.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Aggregate into daily buckets
  const viewsByDay: Record<string, number> = {};
  const clicksByDay: Record<string, number> = {};
  for (const v of dailyViews) {
    const day = v.createdAt.toISOString().split("T")[0];
    viewsByDay[day] = (viewsByDay[day] || 0) + 1;
  }
  for (const c of dailyClicks) {
    const day = c.createdAt.toISOString().split("T")[0];
    clicksByDay[day] = (clicksByDay[day] || 0) + 1;
  }

  return NextResponse.json({
    views: { total: totalViews, "30d": views30d, "7d": views7d, "24h": views24h },
    clicks: { total: totalClicks, "30d": clicks30d, "7d": clicks7d, "24h": clicks24h },
    conversionRate: views30d > 0 ? ((clicks30d / views30d) * 100).toFixed(1) : "0",
    referrers: referrerBreakdown.map((r) => ({
      source: r.referrer || "direct",
      count: r._count.id,
    })),
    viewsByDay,
    clicksByDay,
  });
}
