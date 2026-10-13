import { HM_SELLER_DESCRIPTION } from "@/lib/homes";
import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "homes",
  title: "Sell Your Kansas City Home — Your KC Homes",
  purpose: HM_SELLER_DESCRIPTION,
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
        address: { type: "string", required: false, description: "Property address or city" },
        situation: { type: "string", required: false },
        notes: { type: "string", required: false }
      }
    }
  ]
};
