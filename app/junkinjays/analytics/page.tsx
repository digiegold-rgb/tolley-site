import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JjAnalyticsDashboard from "@/components/junkinjays/jj-analytics";

export const revalidate = 0;

export default async function JjAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/junkinjays/analytics");
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalViews,
    totalClicks,
    recentViews,
    recentClicks,
    referrerBreakdown,
    clickReferrers,
  ] = await Promise.all([
    prisma.jjPageView.count(),
    prisma.jjPhoneClick.count(),
    prisma.jjPageView.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { referrer: true, createdAt: true, ip: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.jjPhoneClick.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { referrer: true, createdAt: true, ip: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.jjPageView.groupBy({
      by: ["referrer"],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    }),
    prisma.jjPhoneClick.groupBy({
      by: ["referrer"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    }),
  ]);

  // Build daily aggregation
  const viewsByDay: Record<string, number> = {};
  const clicksByDay: Record<string, number> = {};
  for (const v of recentViews) {
    const day = v.createdAt.toISOString().split("T")[0];
    viewsByDay[day] = (viewsByDay[day] || 0) + 1;
  }
  for (const c of recentClicks) {
    const day = c.createdAt.toISOString().split("T")[0];
    clicksByDay[day] = (clicksByDay[day] || 0) + 1;
  }

  const data = {
    totalViews,
    totalClicks,
    views30d: recentViews.length,
    clicks30d: recentClicks.length,
    conversionRate: recentViews.length > 0
      ? ((recentClicks.length / recentViews.length) * 100).toFixed(1)
      : "0",
    referrers: referrerBreakdown.map((r) => ({
      source: r.referrer || "direct",
      count: r._count.id,
    })),
    clickReferrers: clickReferrers.map((r) => ({
      source: r.referrer || "direct",
      count: r._count.id,
    })),
    viewsByDay,
    clicksByDay,
    recentClicks: recentClicks.slice(0, 20).map((c) => ({
      referrer: c.referrer,
      ip: c.ip,
      time: c.createdAt.toISOString(),
    })),
  };

  return (
    <div className="min-h-screen bg-[#0c0a05]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#e85d04]">Junkin&apos; Jay&apos;s Analytics</h1>
            <p className="text-sm text-white/40 mt-1">Track where Jay posts this link and who clicks</p>
          </div>
          <a
            href="/junkinjays"
            className="rounded-lg bg-[#e85d04]/10 border border-[#e85d04]/30 px-4 py-2 text-sm text-[#e85d04] hover:bg-[#e85d04]/20"
          >
            View Site
          </a>
        </div>
        <JjAnalyticsDashboard data={data} />
      </div>
    </div>
  );
}
