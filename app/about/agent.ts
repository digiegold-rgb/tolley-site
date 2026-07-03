import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "about",
  title: "About Tolley.io",
  purpose: "How Tolley.io combines real estate, rentals, e-commerce, and AI agents under Your KC Homes LLC — the Independence-MO operator and the DGX Spark stack behind it.",
  url: "/about",
  schemaType: "Organization",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "about",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  actions: []
};
