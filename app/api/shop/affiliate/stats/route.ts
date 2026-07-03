import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aggregate-only affiliate click stats. Built from existing all-time counters
 * on Product (amazonClicks, goClicks*) and AffiliateLink.clicks. There's no
 * time-series here — once we wire the Amazon Associates scraper this endpoint
 * will gain "today / 7d / 30d" fields backed by AmazonStatsSnapshot rows.
 */
export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [
    productAgg,
    topProducts,
    affiliateLinks,
    latestAssociates,
    latestInfluencer,
    featureFlags,
  ] = await Promise.all([
    prisma.product.aggregate({
      _sum: {
        amazonClicks: true,
        goClicksTikTok: true,
        goClicksYouTube: true,
        goClicksInstagram: true,
        goClicksFacebook: true,
        goClicksPinterest: true,
        goClicksDirect: true,
      },
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { amazonClicks: { gt: 0 } },
          { goClicksTikTok: { gt: 0 } },
          { goClicksYouTube: { gt: 0 } },
          { goClicksInstagram: { gt: 0 } },
          { goClicksFacebook: { gt: 0 } },
          { goClicksPinterest: { gt: 0 } },
          { goClicksDirect: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        title: true,
        imageUrls: true,
        status: true,
        amazonAsin: true,
        amazonClicks: true,
        goSlug: true,
        goClicksTikTok: true,
        goClicksYouTube: true,
        goClicksInstagram: true,
        goClicksFacebook: true,
        goClicksPinterest: true,
        goClicksDirect: true,
      },
      take: 200,
    }),
    prisma.affiliateLink.findMany({
      where: { isActive: true },
      orderBy: { clicks: "desc" },
      take: 25,
      select: {
        id: true,
        network: true,
        title: true,
        shortCode: true,
        clicks: true,
        conversions: true,
        revenue: true,
        imageUrl: true,
      },
    }),
    prisma.amazonStatsSnapshot
      .findFirst({
        where: { programType: "associates" },
        orderBy: { capturedAt: "desc" },
      })
      .catch(() => null),
    prisma.influencerStatsSnapshot
      .findFirst({ orderBy: { capturedAt: "desc" } })
      .catch(() => null),
    prisma.amazonFeatureFlag.findMany().catch(() => []),
  ]);

  const sums = productAgg._sum;
  const goClicks =
    (sums.goClicksTikTok ?? 0) +
    (sums.goClicksYouTube ?? 0) +
    (sums.goClicksInstagram ?? 0) +
    (sums.goClicksFacebook ?? 0) +
    (sums.goClicksPinterest ?? 0) +
    (sums.goClicksDirect ?? 0);

  const linkClicksTotal = affiliateLinks.reduce((acc, l) => acc + l.clicks, 0);
  const linkRevenueTotal = affiliateLinks.reduce((acc, l) => acc + l.revenue, 0);
  const linkConversionsTotal = affiliateLinks.reduce((acc, l) => acc + l.conversions, 0);

  const enrichedProducts = topProducts
    .map((p) => {
      const total =
        p.amazonClicks +
        p.goClicksTikTok +
        p.goClicksYouTube +
        p.goClicksInstagram +
        p.goClicksFacebook +
        p.goClicksPinterest +
        p.goClicksDirect;
      return {
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrls[0] ?? null,
        status: p.status,
        amazonAsin: p.amazonAsin,
        goSlug: p.goSlug,
        clicks: {
          amazon: p.amazonClicks,
          tiktok: p.goClicksTikTok,
          youtube: p.goClicksYouTube,
          instagram: p.goClicksInstagram,
          facebook: p.goClicksFacebook,
          pinterest: p.goClicksPinterest,
          direct: p.goClicksDirect,
        },
        total,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  return NextResponse.json({
    totals: {
      amazon: sums.amazonClicks ?? 0,
      tiktok: sums.goClicksTikTok ?? 0,
      youtube: sums.goClicksYouTube ?? 0,
      instagram: sums.goClicksInstagram ?? 0,
      facebook: sums.goClicksFacebook ?? 0,
      pinterest: sums.goClicksPinterest ?? 0,
      direct: sums.goClicksDirect ?? 0,
      goAll: goClicks,
      affiliateLinks: linkClicksTotal,
      grand:
        (sums.amazonClicks ?? 0) + goClicks + linkClicksTotal,
    },
    affiliateLinks: {
      count: affiliateLinks.length,
      clicks: linkClicksTotal,
      conversions: linkConversionsTotal,
      revenue: linkRevenueTotal,
      top: affiliateLinks,
    },
    topProducts: enrichedProducts,
    amazon: {
      associates: latestAssociates
        ? {
            capturedAt: latestAssociates.capturedAt,
            earningsToday: latestAssociates.earningsToday,
            earningsMTD: latestAssociates.earningsMTD,
            earningsYTD: latestAssociates.earningsYTD,
            clicksToday: latestAssociates.clicksToday,
            clicksMTD: latestAssociates.clicksMTD,
            itemsShipped: latestAssociates.itemsShipped,
            itemsOrdered: latestAssociates.itemsOrdered,
            conversionRate: latestAssociates.conversionRate,
          }
        : null,
      influencer: latestInfluencer
        ? {
            capturedAt: latestInfluencer.capturedAt,
            videoViews: latestInfluencer.videoViews,
            storefrontVisits: latestInfluencer.storefrontVisits,
            onsiteEarnings: latestInfluencer.onsiteEarnings,
            offsiteEarnings: latestInfluencer.offsiteEarnings,
            followerCount: latestInfluencer.followerCount,
          }
        : null,
      featureFlags: featureFlags.map((f) => ({
        key: f.key,
        enabled: f.enabled,
        reason: f.reason,
        activatedAt: f.activatedAt,
      })),
    },
  });
}
