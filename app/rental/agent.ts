import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "rental",
  title: "Tolley Rental Hub",
  purpose: "Single rental hub for the Tolley.io network — washer/dryer, generator, trailer, picnic tables, furniture, all in the KC metro.",
  url: "/rental",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "rental",
  shareEndpoint: "/api/share",
  mcpTools: ["list_subsites"],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  actions: []
};
