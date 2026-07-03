import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "real-estate-agent",
  title: "KC Neighborhood Intel + Real Estate Agent",
  purpose: "Pick a Kansas City neighborhood and get a real-estate intel page (comps, schools, market trends, listings) plus a free consult with a local agent.",
  url: "/real-estate-agent",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "real-estate-agent",
  shareEndpoint: "/api/share",
  mcpTools: ["get_real_estate_info"],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  actions: [
    {
      verb: "request_neighborhood_intel",
      description: "Request a neighborhood report and agent consult.",
      fields: {
        neighborhood: { type: "string", required: true, description: "Neighborhood or ZIP" },
        intent: { type: "enum", required: true, enum: ["buyer", "seller", "investor", "renter"] }
      }
    }
  ]
};
