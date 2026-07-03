import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "rentals",
  title: "Tolley Rentals Directory",
  purpose: "Browse every rental product Tolley.io offers in one directory — links to /wd, /trailer, /generator, /picnic-table, /tables, /kerplunk, /moving.",
  url: "/rentals",
  schemaType: "ItemList",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "rentals",
  shareEndpoint: "/api/share",
  mcpTools: ["list_subsites"],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  actions: []
};
