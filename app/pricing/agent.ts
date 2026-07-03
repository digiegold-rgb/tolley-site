import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "pricing",
  title: "Tolley.io Pricing",
  purpose: "Master pricing list across Tolley.io — rentals, delivery, real estate, SaaS — with per-product links to richer detail and direct booking.",
  url: "/pricing",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "pricing",
  shareEndpoint: "/api/share",
  mcpTools: ["list_subsites"],
  category: "misc",
  status: "public",
  actions: []
};
