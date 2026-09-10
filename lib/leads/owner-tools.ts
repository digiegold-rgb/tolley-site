export const OWNER_TOOLS = [
  { slug: "probate", legacy: "serpapi/probate", label: "Probate", group: "Seller research", description: "Review obituary and property evidence, then save an opportunity and its next step." },
  { slug: "distress", legacy: "serpapi/distress", label: "Distress signals", group: "Seller research", description: "Review public distress signals and bring approved opportunities into Today." },
  { slug: "neighborhoods", legacy: "serpapi/neighborhoods", label: "Neighborhood pages", group: "Marketing visibility", description: "Manage neighborhood landing pages, generated FAQs, and publication status." },
  { slug: "maps", legacy: "serpapi/maps", label: "Maps rankings", group: "Marketing visibility", description: "Track local business visibility in Google Maps results." },
  { slug: "ai-overview", legacy: "serpapi/ai-overview", label: "AI search visibility", group: "Marketing visibility", description: "Review recorded citations in AI search summaries." },
  { slug: "reviews", legacy: "reviews", label: "Review requests", group: "Marketing visibility", description: "Manage review requests and inspect their delivery status." },
  { slug: "inventory", legacy: "", label: "Inventory and sales", group: "Commerce", description: "Manage products, listings, repricing, and recorded sales." },
  { slug: "trends", legacy: "trends", label: "Trends and comparables", group: "Commerce", description: "Research product demand, compare prices, and evaluate margins." },
  { slug: "arbitrage", legacy: "arbitrage", label: "Arbitrage", group: "Commerce", description: "Review sourcing opportunities and create product drafts." },
  { slug: "affiliates", legacy: "affiliates", label: "Affiliate links", group: "Commerce", description: "Manage affiliate links and review their recorded performance." },
  { slug: "amazon-subtags", legacy: "amazon-subtags", label: "Amazon tracking", group: "Commerce", description: "Manage tracking IDs and attributed Amazon links." },
  { slug: "analytics", legacy: "analytics", label: "Business analytics", group: "Business operations", description: "Review sales, imported revenue, visitors, click quality, and service health." },
  { slug: "revenue", legacy: "tools/revenue", label: "Revenue imports", group: "Business operations", description: "Import sales workbooks and review existing import results." },
  { slug: "connections", legacy: "tools", label: "Connections and bulk tools", group: "Business operations", description: "Manage selling-platform connections, blocked items, and bulk listing actions." },
] as const;

export function legacyToolDestination(slug: string, query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  return `/leads/tools/${slug}${params.size ? `?${params}` : ""}`;
}
