import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "privacy",
  title: "Privacy Policy",
  purpose: "Tolley.io privacy policy — what we collect, how we use it, your rights.",
  url: "/privacy",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "privacy",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  actions: []
};
