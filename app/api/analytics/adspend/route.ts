import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAccountOverview as fbOverview,
  listCampaigns as fbCampaigns,
  getDailyAccountMetrics as fbDaily,
  getAccountBilling as fbBilling,
} from "@/lib/facebook-ads";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    Number(req.nextUrl.searchParams.get("days")) || 30,
    90,
  );

  const google = {
    overview: null as null,
    campaigns: [] as Array<{ status: string; budget: number }>,
    daily: [] as Array<{ date: string; cost: number }>,
    billing: null,
    error: "Google Ads retired 2026-04-09",
  };

  const facebook = await (async () => {
    try {
      const [overview, campaigns, daily, billing] = await Promise.all([
        fbOverview(days), fbCampaigns(days), fbDaily(days), fbBilling(),
      ]);
      return { overview, campaigns, daily, billing, error: null as string | null };
    } catch (err: unknown) {
      return {
        overview: null,
        campaigns: [] as Awaited<ReturnType<typeof fbCampaigns>>,
        daily: [] as Awaited<ReturnType<typeof fbDaily>>,
        billing: null,
        error: err instanceof Error ? err.message : "Facebook Ads error",
      };
    }
  })();

  // Merge daily metrics by date (google is empty, only fb contributes)
  const dailyMap = new Map<string, { date: string; google: number; facebook: number; total: number }>();
  for (const d of facebook.daily) {
    const entry = dailyMap.get(d.date) || { date: d.date, google: 0, facebook: 0, total: 0 };
    entry.facebook = d.spend;
    entry.total = entry.google + entry.facebook;
    dailyMap.set(d.date, entry);
  }

  const combinedDaily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const gSpend = 0;
  const fbSpend = facebook.overview?.spend || 0;
  const totalSpend = gSpend + fbSpend;

  const gBudget = 0;
  const nowMs = Date.now();
  const fbBudgetTotal = facebook.campaigns.reduce((s, c) => {
    if (c.effectiveStatus !== "ACTIVE" && c.effectiveStatus !== "IN_PROCESS") return s;
    if (c.dailyBudget > 0) return s + c.dailyBudget;
    if (c.lifetimeBudget > 0 && c.stopTime) {
      const stopMs = new Date(c.stopTime).getTime();
      const daysLeft = Math.max(1, (stopMs - nowMs) / 86400000);
      return s + (c.lifetimeBudget / daysLeft);
    }
    return s;
  }, 0);
  const totalDailyBudget = gBudget + fbBudgetTotal;

  const daysWithData = combinedDaily.filter(d => d.total > 0).length || 1;
  const avgDailySpend = totalSpend / daysWithData;
  const projectedMonthly = avgDailySpend * 30;

  const gClicks = 0;
  const fbClicks = facebook.overview?.clicks || 0;
  const totalClicks = gClicks + fbClicks;
  const gConversions = 0;
  const fbLeads = facebook.overview?.leads || 0;
  const totalConversions = gConversions + fbLeads;

  const blendedCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const blendedCpl = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const gAvgDaily = 0;
  const fbAvgDaily = facebook.daily.length > 0
    ? facebook.daily.reduce((s, d) => s + d.spend, 0) / (facebook.daily.filter(d => d.spend > 0).length || 1)
    : 0;

  const gPacing = 0;
  const fbPacing = fbBudgetTotal > 0 ? (fbAvgDaily / fbBudgetTotal) * 100 : 0;

  const monthlyBudget = totalDailyBudget * 30;
  const alertLevel: "green" | "yellow" | "red" =
    projectedMonthly > monthlyBudget * 1.15 ? "red" :
    projectedMonthly > monthlyBudget * 0.95 ? "yellow" : "green";

  return NextResponse.json({
    google,
    facebook,
    combined: {
      daily: combinedDaily,
      totals: {
        google: gSpend,
        facebook: fbSpend,
        total: totalSpend,
        totalClicks,
        totalConversions,
        avgDailySpend,
        projectedMonthly,
      },
      metrics: {
        blendedCpc,
        blendedCpl,
        googleCpc: 0,
        facebookCpc: facebook.overview?.cpc || 0,
        googleConvRate: 0,
        facebookConvRate: fbClicks > 0 ? (fbLeads / fbClicks) * 100 : 0,
        blendedConvRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      },
      budgetVsActual: {
        google: { dailyBudget: gBudget, avgActual: gAvgDaily, pacing: gPacing },
        facebook: { dailyBudget: fbBudgetTotal, avgActual: fbAvgDaily, pacing: fbPacing },
        total: { dailyBudget: totalDailyBudget, avgActual: gAvgDaily + fbAvgDaily, pacing: totalDailyBudget > 0 ? ((gAvgDaily + fbAvgDaily) / totalDailyBudget) * 100 : 0 },
        monthlyBudget,
      },
      alerts: { level: alertLevel, projectedMonthly, monthlyBudget },
    },
  });
}
