import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "billing",
  title: "Tolley.io Billing",
  purpose: "Subscription and billing dashboard for Tolley.io services — manage payment method, invoices, and tier upgrades through Stripe.",
  url: "/billing",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "billing",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  actions: []
};
