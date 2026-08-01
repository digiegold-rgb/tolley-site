import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "go",
  title: "Go Links",
  purpose: "Tolley.io short URL redirects for hand-curated promo links. (Auto-minted agent share links use /s/<token> instead.)",
  url: "/go",
  schemaType: "WebPage",
  skipSitemap: true, // /go itself has no page — only /go/<code> redirects
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "go",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "product",
  status: "public",
  actions: []
};
