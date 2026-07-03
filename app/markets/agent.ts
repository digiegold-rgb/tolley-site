import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "markets",
  title: "Tolley.io Data Marketplace",
  purpose: "Tolley.io neighborhood, MLS, and market intelligence feeds — for analysts, agents, and AI tools that need fresh KC-metro data.",
  url: "/markets",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "markets",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro feeds; nationwide on request",
  actions: [
    {
      verb: "request_data_feed",
      description: "Request a sample of a Tolley.io data feed.",
      fields: {
        feed: { type: "enum", required: true, enum: ["neighborhood", "mls", "market", "custom"] },
        intended_use: { type: "string", required: false }
      }
    }
  ]
};
