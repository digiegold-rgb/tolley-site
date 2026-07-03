import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "pay",
  title: "Tolley Pay",
  purpose: "Stripe-backed checkout for Tolley.io tenants, clients, and one-off invoices — ACH or card, instant receipts.",
  url: "/pay",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "pay",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "product",
  status: "public",
  actions: []
};
