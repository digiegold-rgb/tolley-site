import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "crypto",
  title: "Crypto Trading Data",
  purpose: "Live crypto market data and trading signals from the Digital Gold engine running on DGX Spark.",
  url: "/crypto",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "crypto",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  actions: []
};
