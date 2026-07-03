import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "gpu",
  title: "DGX GPU Specs",
  purpose: "Live specifications and utilization for the DGX Spark GB10 Blackwell GPU powering Tolley.io AI infrastructure.",
  url: "/gpu",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "gpu",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  actions: []
};
