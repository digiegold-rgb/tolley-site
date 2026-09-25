import type { SubsiteManifest } from "@/lib/agent-manifest";
import { LIVE_FAQ } from "@/lib/live/faq";

export const manifest: SubsiteManifest = {
  name: "live",
  title: "Treasure Hauls Live — Live Liquidation Auctions on Whatnot from Kansas City",
  purpose:
    "Tolley's daily live shopping show on Whatnot: estate-sale finds, gadgets, home goods, tools, and garage finds sold live from Kansas City with $1 starts and nationwide shipping. Consign or sell surplus inventory: call/text 913-283-3826.",
  url: "/live",
  schemaType: "LocalBusiness",
  jsonEndpoints: [],
  leadEndpoint: "/api/discovery/inquiry",
  leadSource: "live",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: false,
  serviceArea: "Kansas City metro (ships nationwide via Whatnot)",
  availability: "Daily live shows; times posted on the page and on Whatnot.",
  keywords: ["whatnot", "live auction", "live shopping", "liquidation", "estate finds", "Kansas City"],
  faq: LIVE_FAQ,
  actions: [],
};
