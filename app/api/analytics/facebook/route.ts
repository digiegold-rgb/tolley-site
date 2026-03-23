/**
 * Facebook Analytics API — pulls page insights via Graph API.
 *
 * GET /api/analytics/facebook
 *   Returns insights for all configured FB pages: reach, impressions,
 *   engagement, demographics, and recent post performance.
 *
 * Called by:
 * - Analytics dashboard (client-side fetch)
 * - /api/cron/fb-sync (scheduled refresh)
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getConfiguredPages,
  getPageInsights,
  getPageDemographics,
  getRecentPosts,
  type PageInsights,
  type PostInsight,
} from "@/lib/facebook";

export const dynamic = "force-dynamic";

interface PageAnalytics {
  pageId: string;
  pageName: string;
  insights: Partial<PageInsights>;
  demographics?: PageInsights["demographics"];
  recentPosts: PostInsight[];
  tokenValid: boolean;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = getConfiguredPages();

  if (pages.length === 0) {
    return NextResponse.json({
      configured: false,
      message: "No Facebook page tokens configured. Set FACEBOOK_PAGE_TOKEN_WD in env.",
      pages: [],
    });
  }

  const results: PageAnalytics[] = [];

  for (const page of pages) {
    try {
      const [insights, demographics, recentPosts] = await Promise.all([
        getPageInsights(page.id, page.token, "days_28"),
        getPageDemographics(page.id, page.token),
        getRecentPosts(page.id, page.token, 5),
      ]);

      results.push({
        pageId: page.id,
        pageName: page.name,
        insights: { ...insights, pageName: page.name },
        demographics,
        recentPosts,
        tokenValid: true,
      });
    } catch (e) {
      results.push({
        pageId: page.id,
        pageName: page.name,
        insights: { pageId: page.id },
        recentPosts: [],
        tokenValid: false,
      });
      console.error(`FB analytics error for ${page.name}:`, e);
    }
  }

  // Aggregate totals
  const totals = results.reduce(
    (acc, p) => ({
      totalReach: acc.totalReach + (p.insights.reach || 0),
      totalImpressions: acc.totalImpressions + (p.insights.impressions || 0),
      totalEngaged: acc.totalEngaged + (p.insights.engagedUsers || 0),
      totalPageViews: acc.totalPageViews + (p.insights.pageViews || 0),
      totalNewFans: acc.totalNewFans + (p.insights.newFans || 0),
      totalFans: acc.totalFans + (p.insights.fanCount || 0),
      totalPosts: acc.totalPosts + p.recentPosts.length,
    }),
    {
      totalReach: 0,
      totalImpressions: 0,
      totalEngaged: 0,
      totalPageViews: 0,
      totalNewFans: 0,
      totalFans: 0,
      totalPosts: 0,
    }
  );

  // Best performing post across all pages
  const allPosts = results.flatMap((r) => r.recentPosts);
  const bestPost = allPosts.sort((a, b) => b.engagementRate - a.engagementRate)[0] || null;

  return NextResponse.json({
    configured: true,
    configuredPages: pages.length,
    totals,
    pages: results,
    bestPost,
    fetchedAt: new Date().toISOString(),
  });
}
