import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

interface TreasureHaulPostRecord {
  id?: string;
  url?: string;
  postedAt?: string;
}

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Brand-Page posts published in the last 7d.
  // Source of truth: Product.postizPostIds.treasureHaulPage.postedAt
  const recentlySyndicated = await prisma.product.findMany({
    where: { syndicatedAt: { gte: sevenDaysAgo } },
    select: {
      id: true,
      title: true,
      syndicatedAt: true,
      postizPostIds: true,
    },
  });

  const brandPagePostIds = new Set<string>();
  for (const p of recentlySyndicated) {
    const blob = p.postizPostIds as Record<string, unknown> | null;
    const rec = blob?.treasureHaulPage as TreasureHaulPostRecord | undefined;
    if (rec?.postedAt) {
      const at = new Date(rec.postedAt);
      if (at >= sevenDaysAgo && rec.id) brandPagePostIds.add(rec.id);
    }
  }

  // Lifetime click totals (per-period deltas would require a click history
  // table — surfacing lifetime is the honest version until that exists).
  const totals = await prisma.product.aggregate({
    _sum: {
      goClicksFacebook: true,
      goClicksDirect: true,
      goClicksTikTok: true,
      goClicksYouTube: true,
      goClicksInstagram: true,
      goClicksPinterest: true,
      amazonClicks: true,
    },
  });

  // Breakdown of products with Amazon attribution
  const amazonAttributedCount = await prisma.product.count({
    where: { amazonAsin: { not: null } },
  });

  return NextResponse.json({
    brandPage: {
      postsLast7Days: brandPagePostIds.size,
      pageId: process.env.FACEBOOK_PAGE_ID_TREASURE || "1156652300855210",
      pageUrl: "https://www.facebook.com/RuthannsTreasureHaul",
    },
    lifetime: {
      goClicksFacebook: totals._sum.goClicksFacebook ?? 0,
      goClicksDirect: totals._sum.goClicksDirect ?? 0,
      goClicksTikTok: totals._sum.goClicksTikTok ?? 0,
      goClicksYouTube: totals._sum.goClicksYouTube ?? 0,
      goClicksInstagram: totals._sum.goClicksInstagram ?? 0,
      goClicksPinterest: totals._sum.goClicksPinterest ?? 0,
      amazonClicks: totals._sum.amazonClicks ?? 0,
      amazonAttributedProducts: amazonAttributedCount,
    },
    subtags: {
      // Surfaced so admin can spot-check what's live
      brand_fb: process.env.AMAZON_SUBTAGS_JSON
        ? safeSubtagLookup("brand_fb")
        : null,
      gbp: process.env.AMAZON_SUBTAGS_JSON ? safeSubtagLookup("gbp") : null,
      master: process.env.AMAZON_AFFILIATE_TAG ?? "tolley-shop-20",
    },
  });
}

function safeSubtagLookup(key: string): string | null {
  try {
    const parsed = JSON.parse(process.env.AMAZON_SUBTAGS_JSON || "{}");
    if (parsed && typeof parsed === "object") {
      const v = (parsed as Record<string, unknown>)[key];
      return typeof v === "string" ? v : null;
    }
  } catch {
    return null;
  }
  return null;
}
