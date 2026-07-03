import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "advertising",
  title: "Advertising on Tolley.io",
  purpose: "Sponsored placements across the Tolley.io network of KC service pages — real-estate, rentals, e-commerce, content; rate card on request.",
  url: "/advertising",
  schemaType: "WebPage",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "advertising",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  actions: [
    {
      verb: "request_ad_ratecard",
      description: "Request the Tolley.io rate card and audience figures.",
      fields: {
        company: { type: "string", required: false },
        budget_range: { type: "enum", required: false, enum: ["under_500", "500_2k", "2k_10k", "over_10k"] }
      }
    }
  ]
};
