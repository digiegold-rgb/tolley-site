import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "signup",
  title: "Sign Up",
  purpose: "Create a Tolley.io account — single login across leads, agents, food, scan, video, and client portal.",
  url: "/signup",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "signup",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "misc",
  status: "public",
  actions: []
};
