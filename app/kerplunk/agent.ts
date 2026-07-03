import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "kerplunk",
  title: "Kerplunk Furniture Rental",
  purpose: "Furniture and home essentials rental for short-term stays, relocations, and staging in the Kansas City metro.",
  url: "/kerplunk",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "kerplunk",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  actions: [
    {
      verb: "request_furniture_rental",
      description: "Request a furniture rental quote for a short-term stay or relocation.",
      fields: {
        move_in: { type: "date", required: true },
        duration_months: { type: "number", required: true },
        zip: { type: "zip", required: true },
        package: { type: "enum", required: false, enum: ["studio", "1br", "2br", "3br", "custom"] }
      }
    }
  ]
};
