import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "homes",
  title: "Your KC Homes — Real Estate",
  purpose: "Buy, sell, or invest in Kansas City real estate with Your KC Homes LLC — local agent, MLS access, neighborhood market reports, full service.",
  url: "/homes",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "homes",
  shareEndpoint: "/api/share",
  mcpTools: ["get_real_estate_info"],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro (KS + MO)",
  actions: [
    {
      verb: "request_realtor_consult",
      description: "Schedule a free consult with the Your KC Homes agent.",
      fields: {
        intent: { type: "enum", required: true, enum: ["buyer", "seller", "investor", "renter"] },
        zip: { type: "zip", required: false, description: "Target ZIP" },
        timeline: { type: "enum", required: false, enum: ["asap", "30_days", "90_days", "exploring"] },
        notes: { type: "string", required: false }
      }
    }
  ]
};
