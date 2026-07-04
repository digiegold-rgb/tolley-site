import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { publicSubsites, SUBSITES } from "@/lib/subsites";

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
    "/real-estate-agent": 0.9,
    "/rental": 0.8,
    "/wd": 0.7,
    "/leads": 0.7,
    "/food": 0.7,
    "/sales": 0.8,
    "/snap-and-know": 0.7,
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

  const subsiteRoutes: MetadataRoute.Sitemap = SUBSITES.map((s) => ({
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
    { url: `${BASE}/snap-and-know`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/shop/disclosure`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${BASE}/shop/guides/best-kitchen-gadgets-under-50`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

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

  return [homeRoute, ...subsiteRoutes, ...extras, ...neighborhoodRoutes];
}
