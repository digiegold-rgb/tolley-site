import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { publicSubsites, SUBSITES } from "@/lib/subsites";
import { blogPosts } from "@/lib/blog-posts";

const BASE = "https://www.tolley.io";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * App-Router sitemap. Powered by `lib/subsites.ts` so adding a subsite is one
 * file, not a sitemap edit. Auth-gated subsites are still listed (lower priority)
 * because their public manifest endpoints are agent-discoverable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const priorityMap: Record<string, number> = {
    "/": 1.0,
    "/shop": 0.9,
    "/estate": 0.9,
    "/real-estate-agent": 0.9,
    "/rental": 0.8,
    "/wd": 0.7,
    "/leads": 0.7,
    "/food": 0.7,
    "/sales": 0.8,
    "/scan": 0.7,
    "/blog": 0.7,
    "/pools": 0.6,
    "/water": 0.6,
    "/drive": 0.6,
    "/vater": 0.5,
  };

  const homeRoute: MetadataRoute.Sitemap[number] = {
    url: `${BASE}/`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 1.0,
  };

  // Registry entries that must NOT be submitted to crawlers: /water is
  // noindex (contradictory signal), /crypto 301s into robots-blocked
  // /trading, and the rest render login walls — submitting them tells Google
  // the site is mostly auth-gated dashboards.
  const sitemapExclude = new Set([
    "/water",
    "/crypto",
    "/agents",
    "/client",
    "/food",
    "/leads",
    "/scan",
    "/video",
  ]);

  const subsiteRoutes: MetadataRoute.Sitemap = SUBSITES.filter(
    (s) => !s.skipSitemap && !sitemapExclude.has(s.url),
  ).map((s) => ({
    url: `${BASE}${s.url}`,
    lastModified: now,
    changeFrequency:
      s.category === "marketing" || s.category === "product"
        ? ("weekly" as const)
        : ("monthly" as const),
    priority: priorityMap[s.url] ?? (s.status === "public" ? 0.5 : 0.3),
  }));

  // Curated extras not represented as standalone subsites
  const extras: MetadataRoute.Sitemap = [
    { url: `${BASE}/leads/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/leads/onboard`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/shop/disclosure`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${BASE}/shop/guides/best-kitchen-gadgets-under-50`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Real content pages that were missing while login walls got submitted.
    { url: `${BASE}/shop/haul`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/shop/reviews`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/shop/sold`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/shop/videos`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/estate/our-work`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/tools/missed-call-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/tools/lead-follow-up-audit`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/tools/digital-presence-audit`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/tools/phone-presence-audit`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Blog posts — 10 static articles that were invisible to crawlers.
  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Estate sale pages (public teasers; addresses stay gated by publish time).
  const estateSales = await prisma.estateSale
    .findMany({
      where: { status: { in: ["upcoming", "live", "done"] } },
      select: { slug: true, updatedAt: true },
    })
    .catch(() => []);

  const estateRoutes: MetadataRoute.Sitemap = estateSales.map((s) => ({
    url: `${BASE}/estate/sales/${s.slug}`,
    lastModified: s.updatedAt ?? now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Shop product pages — listed items only (sold pages stay live for old FB
  // deep-links but don't need crawl budget).
  const products = await prisma.product
    .findMany({
      where: {
        status: "listed",
        listings: { some: { platform: "shop", status: "active" } },
        imageUrls: { isEmpty: false },
      },
      select: { id: true, updatedAt: true },
    })
    .catch(() => []);

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE}/shop/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const neighborhoods = await prisma.neighborhoodPage
    .findMany({
      where: { published: true },
      select: { slug: true, generatedAt: true, updatedAt: true },
    })
    .catch(() => []);

  const neighborhoodRoutes: MetadataRoute.Sitemap = neighborhoods.map((n) => ({
    url: `${BASE}/real-estate-agent/${n.slug}`,
    lastModified: n.generatedAt ?? n.updatedAt ?? now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Use publicSubsites for log so we don't surprise builds
  void publicSubsites;

  return [
    homeRoute,
    ...subsiteRoutes,
    ...extras,
    ...blogRoutes,
    ...estateRoutes,
    ...productRoutes,
    ...neighborhoodRoutes,
  ];
}
