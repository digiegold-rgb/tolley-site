import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { amazonAffiliateUrl, tiktokShopUrl } from "@/lib/shop";
import { classifyClick } from "@/lib/shop/click-classifier";
import { ensureSubtagsLoaded } from "@/lib/amazon/subtags";

export const runtime = "nodejs";

const SRC_TO_FIELD: Record<
  string,
  | "goClicksTikTok"
  | "goClicksYouTube"
  | "goClicksInstagram"
  | "goClicksFacebook"
  | "goClicksPinterest"
  | "goClicksDirect"
> = {
  tt: "goClicksTikTok",
  tiktok: "goClicksTikTok",
  yt: "goClicksYouTube",
  youtube: "goClicksYouTube",
  ig: "goClicksInstagram",
  instagram: "goClicksInstagram",
  fb: "goClicksFacebook",
  facebook: "goClicksFacebook",
  // Treasure Haul brand Page collapses into the FB counter for now —
  // distinct attribution for revenue lives in the Amazon subtag (tolley-brand-fb-20).
  brand_fb: "goClicksFacebook",
  brand_facebook: "goClicksFacebook",
  treasure_haul: "goClicksFacebook",
  // Google Business Profile / Maps traffic — counted as Direct on the product
  // side; for revenue, the tolley-gbp-20 subtag carries the attribution.
  gbp: "goClicksDirect",
  google_maps: "goClicksDirect",
  google_business: "goClicksDirect",
  pin: "goClicksPinterest",
  pinterest: "goClicksPinterest",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const url = new URL(req.url);
  const src = (url.searchParams.get("src") || "").toLowerCase();
  const platform = (url.searchParams.get("platform") || "").toLowerCase();
  const origin = url.origin;

  const click = await classifyClick(req);
  await ensureSubtagsLoaded();

  const product = await prisma.product
    .findUnique({ where: { goSlug: code } })
    .catch(() => null);

  if (product) {
    prisma.siteEvent
      .create({
        data: {
          site: "shop",
          path: `/go/${code}`,
          event: "go_redirect",
          label: src || null,
          userAgent: click.ua,
          ip: click.ip,
          meta: {
            productId: product.id,
            src: src || null,
            platform: platform || null,
            isBot: click.isBot,
            botReason: click.reason,
            destination:
              platform === "tiktok" && product.tiktokShopId
                ? "tiktok"
                : platform === "amazon" && product.amazonAsin
                  ? "amazon"
                  : product.status === "sold"
                    ? product.amazonAsin
                      ? "amazon"
                      : "shop_index"
                    : "shop_detail",
          },
        },
      })
      .catch(() => {});

    if (!click.isBot) {
      const field = SRC_TO_FIELD[src] ?? "goClicksDirect";
      prisma.product
        .update({ where: { id: product.id }, data: { [field]: { increment: 1 } } })
        .catch(() => {});
    }

    // Explicit platform override — used when sharing a product specifically
    // for TikTok Shop or Amazon affiliate, regardless of in-stock status.
    if (platform === "tiktok" && product.tiktokShopId) {
      const tt = tiktokShopUrl(product.tiktokShopId);
      if (tt) return NextResponse.redirect(tt, 302);
    }
    if (platform === "amazon" && product.amazonAsin) {
      const amazon = amazonAffiliateUrl(product.amazonAsin, undefined, src);
      if (amazon) return NextResponse.redirect(amazon, 302);
    }

    if (product.status === "sold") {
      const amazon = amazonAffiliateUrl(product.amazonAsin, undefined, src);
      if (amazon) return NextResponse.redirect(amazon, 302);
      return NextResponse.redirect(new URL("/shop", origin), 302);
    }

    return NextResponse.redirect(new URL(`/shop/${product.id}`, origin), 302);
  }

  const link = await prisma.affiliateLink
    .findUnique({ where: { shortCode: code } })
    .catch(() => null);

  if (link?.isActive) {
    prisma.siteEvent
      .create({
        data: {
          site: "shop",
          path: `/go/${code}`,
          event: "affiliate_click",
          label: link.network,
          userAgent: click.ua,
          ip: click.ip,
          meta: {
            shortCode: code,
            network: link.network,
            isBot: click.isBot,
            botReason: click.reason,
          },
        },
      })
      .catch(() => {});

    if (!click.isBot) {
      prisma.affiliateLink
        .update({ where: { id: link.id }, data: { clicks: { increment: 1 } } })
        .catch(() => {});
    }
    return NextResponse.redirect(link.affiliateUrl, 302);
  }

  return NextResponse.redirect(new URL("/shop", origin), 302);
}
