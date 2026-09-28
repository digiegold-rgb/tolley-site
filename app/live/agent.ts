import type { SubsiteManifest } from "@/lib/agent-manifest";
import { SHOW_DESCRIPTION, SHOW_TIME } from "@/lib/live/campaign";
import { LIVE_FAQ } from "@/lib/live/faq";

export const manifest: SubsiteManifest = {
  name: "live",
  title: "Treasure Hauls Live — Live Liquidation Auctions on Whatnot from Kansas City",
  purpose: SHOW_DESCRIPTION,
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
  availability: `Most evenings at ${SHOW_TIME}; only confirmed dates appear on the public schedule.`,
  keywords: ["whatnot", "live auction", "live shopping", "liquidation", "estate finds", "Kansas City"],
  faq: LIVE_FAQ,
  actions: [],
};
