// FB Sync Cron — pulls Facebook page insights every 6 hours.
// Schedule: every 6h via vercel.json
// Stores aggregated insights in SiteEvent for dashboard tracking
// and sends a Telegram notification if any page has notable activity.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getConfiguredPages,
  getPageInsights,
  getRecentPosts,
} from "@/lib/facebook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8315253075:AAEsWk-38MIJLwcctWsqOu87KiHXrIphS_M";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "1680894605";

async function sendTelegram(text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch {
    console.error("Telegram send failed");
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow from Vercel cron (no auth header) or with valid secret
    const url = new URL(request.url);
    if (!url.searchParams.has("cron") && authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const pages = getConfiguredPages();
  if (pages.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No FB pages configured" });
  }

  const results = [];
  let totalReach = 0;
  let totalNewFans = 0;

  for (const page of pages) {
    try {
      const insights = await getPageInsights(page.id, page.token, "day");
      const posts = await getRecentPosts(page.id, page.token, 3);

      // Store as SiteEvent for dashboard aggregation
      await prisma.siteEvent.create({
        data: {
          site: "fb_" + page.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          path: "/facebook",
          event: "fb_insights_sync",
          label: page.name,
          meta: {
            pageId: page.id,
            reach: insights.reach || 0,
            impressions: insights.impressions || 0,
            engagedUsers: insights.engagedUsers || 0,
            pageViews: insights.pageViews || 0,
            newFans: insights.newFans || 0,
            fanCount: insights.fanCount || 0,
            topPostId: posts[0]?.id || null,
            syncedAt: new Date().toISOString(),
          },
        },
      });

      totalReach += insights.reach || 0;
      totalNewFans += insights.newFans || 0;

      results.push({
        page: page.name,
        reach: insights.reach || 0,
        impressions: insights.impressions || 0,
        engaged: insights.engagedUsers || 0,
        posts: posts.length,
      });
    } catch (e) {
      results.push({ page: page.name, error: e instanceof Error ? e.message : "Unknown" });
    }
  }

  // Telegram notification if there's notable activity
  if (totalReach > 0 || totalNewFans > 0) {
    const lines = results.map((r) => {
      if ("error" in r) return `- ${r.page}: Error`;
      return `- ${r.page}: ${r.reach} reach, ${r.impressions} impr, ${r.engaged} engaged`;
    });

    await sendTelegram(
      `*FB Sync Complete*\n${lines.join("\n")}\n\nTotal: ${totalReach} reach, +${totalNewFans} new fans`
    );
  }

  return NextResponse.json({
    synced: true,
    pages: results,
    totalReach,
    totalNewFans,
    syncedAt: new Date().toISOString(),
  });
}
