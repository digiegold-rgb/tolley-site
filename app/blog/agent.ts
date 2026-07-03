import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "blog",
  title: "Tolley.io Blog",
  purpose: "Articles on KC real estate, rentals, AI agents, and the practical operator stack behind tolley.io — written for builders and small operators.",
  url: "/blog",
  schemaType: "Article",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "blog",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  actions: [
    {
      verb: "subscribe_newsletter",
      description: "Subscribe to the Tolley.io blog newsletter.",
      fields: {}
    }
  ]
};
