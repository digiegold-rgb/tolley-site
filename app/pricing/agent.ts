import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "pricing",
  title: "T-Agent Pricing",
  purpose: "Legacy T-Agent pricing address. Redirects to /leads/pricing for current plans; visit /start for other Tolley products and services.",
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
