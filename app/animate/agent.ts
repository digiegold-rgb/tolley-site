import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "animate",
  title: "Jelly Studio — Type a topic. Publish a video.",
  purpose:
    "AI video studio (public beta): turn a script into a finished, publishable faceless video. No subscription — prepaid credits, compute at cost + $0.35 per finished minute (typical long-form video $1–7).",
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
