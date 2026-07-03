import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "results",
  title: "Results & Case Studies",
  purpose: "Outcomes and case studies from Tolley.io services — agent ROI, rental utilization, AI pipeline saves.",
  url: "/results",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "results",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  actions: []
};
