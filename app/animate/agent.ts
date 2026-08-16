import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "animate",
  title: "Jelly Studio — Type a topic. Publish a video.",
  purpose:
    "AI video studio (public beta): turn a script into a finished, publishable faceless video. The most affordable way to make faceless videos — pay only for what you render (typical long-form video $1–7), prepaid credits, no subscription, no commitment.",
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
