import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "realestateanimated",
  title: "Listing Studio by Jelly! — listing videos from one photo",
  purpose:
    "Real-estate lane of Jelly! Studio for agents: upload one listing photo, pick Virtual Staging or a Before→After Reveal, pay per video, post it. Includes Equal Housing Opportunity on exports, virtual-staging labels, broker end cards, and a public proof page. Beta with automatic email signup links and in-app support tickets.",
  url: "/realestateanimated",
  schemaType: "SoftwareApplication",
  jsonEndpoints: [],
  leadEndpoint: "/api/vater/invite-request",
  leadSource: "realestate-landing",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "product",
  status: "public",
  skipJsonLd: true,
  pricing: [
    { unit: "photo", amount: 4.99, currency: "USD", notes: "Virtual Staging still; pay per photo" },
    { unit: "video", amount: 29, currency: "USD", notes: "Before → After Reveal; pay per video, no subscription" },
  ],
  actions: [],
};
