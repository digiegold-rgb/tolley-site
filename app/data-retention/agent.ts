import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "data-retention",
  title: "Data Retention Policy",
  purpose: "How long Tolley.io stores user data, MLS records, scans, leads, and analytics — and how to request deletion.",
  url: "/data-retention",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "data-retention",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  actions: []
};
