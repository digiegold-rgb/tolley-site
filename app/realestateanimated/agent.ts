import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "realestateanimated",
  title: "Listing Studio by Jelly! — listing videos from one photo",
  purpose:
    "Real-estate lane of Jelly! Studio for agents: upload one listing photo, pick Virtual Staging or a Before→After Reveal, pay per video, post it. Fair-Housing safe by default (Equal Housing Opportunity on every export, on-frame virtual-staging label, broker line per state rules, MLS-safe export, public proof page). Invite-only beta.",
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
