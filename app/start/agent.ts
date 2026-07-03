import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "start",
  title: "Get Started with Tolley.io",
  purpose: "Quick-start path for new Tolley.io users — pick the product (rentals, real estate, AI agents) and get to first value in under 5 minutes.",
  url: "/start",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "start",
  shareEndpoint: "/api/share",
  mcpTools: ["list_subsites"],
  category: "marketing",
  status: "public",
  actions: []
};
