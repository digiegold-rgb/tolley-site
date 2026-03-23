import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAccountOverview as gOverview,
  listCampaigns as gCampaigns,
  getDailyAccountMetrics as gDaily,
} from "@/lib/google-ads";
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

  // Fetch both platforms in parallel — catch individually so one failing doesn't break the other
  const [google, facebook] = await Promise.all([
    (async () => {
      try {
        const [overview, campaigns, daily] = await Promise.all([
          gOverview(days), gCampaigns(days), gDaily(days),
        ]);
        return { overview, campaigns, daily, billing: null, error: null };
      } catch (err: unknown) {
        return { overview: null, campaigns: [], daily: [], billing: null, error: err instanceof Error ? err.message : "Google Ads error" };
      }
    })(),
    (async () => {
      try {
        const [overview, campaigns, daily, billing] = await Promise.all([
          fbOverview(days), fbCampaigns(days), fbDaily(days), fbBilling(),
        ]);
        return { overview, campaigns, daily, billing, error: null };
      } catch (err: unknown) {
        return { overview: null, campaigns: [], daily: [], billing: null, error: err instanceof Error ? err.message : "Facebook Ads error" };
      }
    })(),
  ]);

  // Merge daily metrics by date
  const dailyMap = new Map<string, { date: string; google: number; facebook: number; total: number }>();

  for (const d of google.daily) {
    const entry = dailyMap.get(d.date) || { date: d.date, google: 0, facebook: 0, total: 0 };
    entry.google = d.cost;
    entry.total = entry.google + entry.facebook;
    dailyMap.set(d.date, entry);
  }
  for (const d of facebook.daily) {
    const entry = dailyMap.get(d.date) || { date: d.date, google: 0, facebook: 0, total: 0 };
    entry.facebook = d.spend;
    entry.total = entry.google + entry.facebook;
    dailyMap.set(d.date, entry);
  }

  const combinedDaily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Running totals
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfWeek = now.getDay() || 7; // 1-7

  const gSpend = google.overview?.cost || 0;
  const fbSpend = facebook.overview?.spend || 0;
  const totalSpend = gSpend + fbSpend;

  // Budget: sum daily budgets from campaigns
  const gBudget = google.campaigns.reduce((s, c) => s + (c.status === "ENABLED" ? c.budget : 0), 0);
  const fbBudgetTotal = facebook.campaigns.reduce((s, c) => s + (c.effectiveStatus === "ACTIVE" ? c.dailyBudget : 0), 0);
  const totalDailyBudget = gBudget + fbBudgetTotal;

  // Averages
  const daysWithData = combinedDaily.filter(d => d.total > 0).length || 1;
  const avgDailySpend = totalSpend / daysWithData;
  const projectedMonthly = avgDailySpend * 30;

  // Blended metrics
  const gClicks = google.overview?.clicks || 0;
  const fbClicks = facebook.overview?.clicks || 0;
  const totalClicks = gClicks + fbClicks;
  const gConversions = google.overview?.conversions || 0;
  const fbLeads = facebook.overview?.leads || 0;
  const totalConversions = gConversions + fbLeads;

  const blendedCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const blendedCpl = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Pacing
  const gAvgDaily = google.daily.length > 0
    ? google.daily.reduce((s, d) => s + d.cost, 0) / google.daily.filter(d => d.cost > 0).length || 0
    : 0;
  const fbAvgDaily = facebook.daily.length > 0
    ? facebook.daily.reduce((s, d) => s + d.spend, 0) / facebook.daily.filter(d => d.spend > 0).length || 0
    : 0;

  const gPacing = gBudget > 0 ? (gAvgDaily / gBudget) * 100 : 0;
  const fbPacing = fbBudgetTotal > 0 ? (fbAvgDaily / fbBudgetTotal) * 100 : 0;

  // Alert level
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
        googleCpc: google.overview?.avgCpc || 0,
        facebookCpc: facebook.overview?.cpc || 0,
        googleConvRate: gClicks > 0 ? (gConversions / gClicks) * 100 : 0,
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
