import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "animate",
  title: "Jelly Studio — Type a topic. Publish a video.",
  purpose:
    "AI video studio: turn a topic into a finished, publishable video. No subscription — pay per video, ~$25 each, billed automatically via Stripe.",
  url: "/animate",
  schemaType: "SoftwareApplication",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "animate",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "product",
  status: "public",
  skipJsonLd: true,
  pricing: [
    {
      unit: "video",
      amount: 25,
      currency: "USD",
      notes: "Pay per finished video; no subscription",
    },
  ],
  actions: [],
};
