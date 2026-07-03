import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "client",
  title: "Tolley.io Client Portal",
  purpose: "Customer dashboard for Tolley.io services — invoices, contracts, service history, Stripe ACH/card pay, support chat.",
  url: "/client",
  schemaType: "WebPage",
  jsonEndpoints: ["/api/client/public"],
  leadEndpoint: "/api/email-capture",
  leadSource: "client",
  shareEndpoint: "/api/share",
  mcpTools: ["get_subsite_info"],
  category: "product",
  status: "auth",
  actions: []
};
