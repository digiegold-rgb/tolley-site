import { COMPANY } from "@/lib/company-profile";
import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "about",
  title: "About Tolley.io",
  purpose: COMPANY.description,
  url: "/about",
  schemaType: "Organization",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "about",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  actions: []
};
