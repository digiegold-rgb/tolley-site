import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "tools",
  title: "Tolley.io Free Tools",
  purpose: "Free real-estate, rental, and AI tools — calculators, audits, lead-flow analyzers; email capture only, no signup.",
  url: "/tools",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "tools",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "product",
  status: "public",
  actions: []
};
