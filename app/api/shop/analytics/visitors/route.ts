import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

const BOT_UA =
  /bot|crawl|spider|slurp|bingbot|googlebot|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|pinterest|whatsapp|telegram|discordbot|curl\/|wget\/|python-requests|java-http|go-http|okhttp|postman|insomnia|headlesschrome|phantomjs|axios/i;

// Admin-only paths — exclude from visitor/funnel numbers since these are
// never real shoppers, just the operator using the dashboard or new-listing
// flow. Public storefront paths (/shop, /shop/sold, /shop/videos, etc.) and
// product detail anchors are kept.
const ADMIN_PATH_PREFIXES = [
  "/shop/admin",
  "/shop/dashboard",
  "/shop/new",
];

function isAdminPath(path: string): boolean {
  return ADMIN_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function getSkipHashes(): Set<string> {
  const salt = process.env.ANALYTICS_IP_SALT;
  const skipIps = (process.env.ANALYTICS_SKIP_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!salt || skipIps.length === 0) return new Set();
  const hashes = new Set<string>();
  for (const ip of skipIps) {
    hashes.add(createHmac("sha256", salt).update(ip).digest("hex"));
  }
  return hashes;
}

function getSkipIpsRaw(): Set<string> {
  return new Set(
    (process.env.ANALYTICS_SKIP_IPS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function GET(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.max(1, Math.min(180, parseInt(req.nextUrl.searchParams.get("days") || "30", 10)));
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

  const [views, events, prevViews, prevEvents] = await Promise.all([
    prisma.siteView.findMany({
      where: { site: "shop", createdAt: { gte: since } },
      select: {
        path: true,
        referrer: true,
        ipHash: true,
        ip: true,
        userAgent: true,
        country: true,
        city: true,
        region: true,
        createdAt: true,
      },
    }),
    prisma.siteEvent.findMany({
      where: { site: "shop", createdAt: { gte: since } },
      select: {
        path: true,
        event: true,
        label: true,
        meta: true,
        referrer: true,
        ipHash: true,
        ip: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    prisma.siteView.findMany({
      where: { site: "shop", createdAt: { gte: prevSince, lt: since } },
      select: { path: true, ipHash: true, ip: true, userAgent: true },
    }),
    prisma.siteEvent.findMany({
      where: { site: "shop", createdAt: { gte: prevSince, lt: since }, event: "buy_click" },
      select: { ipHash: true, ip: true, userAgent: true, label: true, meta: true },
    }),
  ]);

  const skipHashes = getSkipHashes();
  const skipIpsRaw = getSkipIpsRaw();

  const keepRow = (r: {
    ip: string | null;
    ipHash: string | null;
    userAgent: string | null;
  }): boolean => {
    if (r.userAgent && BOT_UA.test(r.userAgent)) return false;
    if (r.ipHash && skipHashes.has(r.ipHash)) return false;
    if (r.ip && skipIpsRaw.has(r.ip)) return false;
    return true;
  };

  // Visitor/funnel numbers exclude admin paths (operator views) AND
  // self-IPs (configured via ANALYTICS_SKIP_IPS).
  const keepView = (r: {
    path: string;
    ip: string | null;
    ipHash: string | null;
    userAgent: string | null;
  }): boolean => {
    if (!keepRow(r)) return false;
    if (isAdminPath(r.path)) return false;
    return true;
  };

  const v = views.filter(keepView);
  const e = events.filter(keepRow);
  const pv = prevViews.filter(keepView);
  const pe = prevEvents.filter(keepRow);

  const dedup = (r: { ip: string | null; ipHash: string | null }) => r.ipHash || r.ip || null;

  // Daily series + unique visitor counts
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dateKeys.push(d.toISOString().split("T")[0]);
  }
  const daily: Record<string, { views: number; visitors: Set<string>; productViews: number; buyClicks: number }> = {};
  for (const day of dateKeys) {
    daily[day] = { views: 0, visitors: new Set(), productViews: 0, buyClicks: 0 };
  }
  for (const row of v) {
    const day = row.createdAt.toISOString().split("T")[0];
    if (!daily[day]) continue;
    daily[day].views++;
    const k = dedup(row);
    if (k) daily[day].visitors.add(k);
  }
  for (const row of e) {
    const day = row.createdAt.toISOString().split("T")[0];
    if (!daily[day]) continue;
    if (row.event === "product_view") daily[day].productViews++;
    if (row.event === "buy_click") daily[day].buyClicks++;
  }
  const dailySeries = dateKeys.map((d) => ({
    date: d,
    views: daily[d].views,
    visitors: daily[d].visitors.size,
    productViews: daily[d].productViews,
    buyClicks: daily[d].buyClicks,
  }));

  // Unique-visitor totals
  const visitorSet = new Set<string>();
  for (const row of v) {
    const k = dedup(row);
    if (k) visitorSet.add(k);
  }
  const prevVisitorSet = new Set<string>();
  for (const row of pv) {
    const k = dedup(row);
    if (k) prevVisitorSet.add(k);
  }

  // Referrer breakdown
  const refMap: Record<string, number> = {};
  for (const row of v) {
    const r = row.referrer || "direct";
    refMap[r] = (refMap[r] || 0) + 1;
  }
  const referrers = Object.entries(refMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Top paths
  const pathMap: Record<string, number> = {};
  for (const row of v) {
    pathMap[row.path] = (pathMap[row.path] || 0) + 1;
  }
  const topPaths = Object.entries(pathMap)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Geo
  const countryMap: Record<string, number> = {};
  const cityMap: Record<string, number> = {};
  for (const row of v) {
    if (row.country) countryMap[row.country] = (countryMap[row.country] || 0) + 1;
    if (row.city && row.region) {
      const key = `${row.city}, ${row.region}`;
      cityMap[key] = (cityMap[key] || 0) + 1;
    }
  }
  const topCountries = Object.entries(countryMap)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topCities = Object.entries(cityMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Per-product engagement
  const productAgg: Record<
    string,
    { views: number; clicks: Record<string, number> }
  > = {};
  for (const ev of e) {
    if (ev.event === "product_view" && ev.label) {
      const id = ev.label;
      if (!productAgg[id]) productAgg[id] = { views: 0, clicks: {} };
      productAgg[id].views++;
    } else if (ev.event === "buy_click" && ev.label) {
      const id = ev.label;
      if (!productAgg[id]) productAgg[id] = { views: 0, clicks: {} };
      const dest = (ev.meta as { dest?: string } | null)?.dest || "unknown";
      productAgg[id].clicks[dest] = (productAgg[id].clicks[dest] || 0) + 1;
    }
  }

  const productIds = Object.keys(productAgg);
  const productRows = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true, imageUrls: true, targetPrice: true, status: true },
      })
    : [];
  const productById = new Map(productRows.map((p) => [p.id, p]));

  const topProducts = productIds
    .map((id) => {
      const p = productById.get(id);
      const agg = productAgg[id];
      const totalClicks = Object.values(agg.clicks).reduce((a, b) => a + b, 0);
      return {
        id,
        title: p?.title || "(deleted)",
        imageUrl: p?.imageUrls?.[0] || null,
        price: p?.targetPrice ?? null,
        status: p?.status ?? null,
        views: agg.views,
        clicks: totalClicks,
        clicksByDest: agg.clicks,
        ctr: agg.views > 0 ? Math.round((totalClicks / agg.views) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  // Aggregate clicks by destination (funnel + breakdown)
  const clicksByDest: Record<string, number> = {};
  for (const ev of e) {
    if (ev.event === "buy_click") {
      const dest = (ev.meta as { dest?: string } | null)?.dest || "unknown";
      clicksByDest[dest] = (clicksByDest[dest] || 0) + 1;
    }
  }

  // Sales in this window (Stripe checkouts on the shop platform)
  const sales = await prisma.shopSale.count({
    where: { soldAt: { gte: since }, platform: "shop" },
  });

  const totalProductViews = e.filter((x) => x.event === "product_view").length;
  const totalBuyClicks = e.filter((x) => x.event === "buy_click").length;
  const prevBuyClicks = pe.length;

  // Visibility into what the filter dropped so the UI can show "your visits
  // excluded".
  const dropped = {
    bots: views.length - views.filter((r) => !(r.userAgent && BOT_UA.test(r.userAgent))).length,
    self: views.filter((r) => (r.ipHash && skipHashes.has(r.ipHash)) || (r.ip && skipIpsRaw.has(r.ip))).length,
    admin: views.filter((r) => keepRow(r) && isAdminPath(r.path)).length,
  };

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    filters: {
      ...dropped,
      skipIpsConfigured: skipIpsRaw.size,
    },
    overview: {
      visitors: visitorSet.size,
      prevVisitors: prevVisitorSet.size,
      pageViews: v.length,
      prevPageViews: pv.length,
      productViews: totalProductViews,
      buyClicks: totalBuyClicks,
      prevBuyClicks,
      sales,
    },
    funnel: {
      visitors: visitorSet.size,
      productViews: totalProductViews,
      buyClicks: totalBuyClicks,
      sales,
      visitorToView: visitorSet.size > 0 ? Math.round((totalProductViews / visitorSet.size) * 1000) / 10 : 0,
      viewToClick: totalProductViews > 0 ? Math.round((totalBuyClicks / totalProductViews) * 1000) / 10 : 0,
      clickToSale: totalBuyClicks > 0 ? Math.round((sales / totalBuyClicks) * 1000) / 10 : 0,
    },
    daily: dailySeries,
    referrers,
    topPaths,
    topCountries,
    topCities,
    topProducts,
    clicksByDest: Object.entries(clicksByDest)
      .map(([dest, count]) => ({ dest, count }))
      .sort((a, b) => b.count - a.count),
  });
}
