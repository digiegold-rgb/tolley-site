import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "junkinjays",
  title: "Junk in Jay's",
  purpose: "Same-day junk removal in the Kansas City metro — single items to full cleanouts; transparent flat-rate pricing, eco-friendly disposal.",
  url: "/junkinjays",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "junkinjays",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  availability: "Same-day pickup.",
  pricing: [
    { unit: "single item", amount: 49, currency: "USD" },
    { unit: "1/4 truck", amount: 149, currency: "USD" },
    { unit: "1/2 truck", amount: 249, currency: "USD" },
    { unit: "full truck", amount: 449, currency: "USD" }
  ],
  actions: [
    {
      verb: "request_junk_pickup",
      description: "Schedule junk removal pickup for a Kansas City address.",
      fields: {
        zip: { type: "zip", required: true },
        items: { type: "string", required: true, description: "What to remove (couch, fridge, full garage, etc.)" },
        urgency: { type: "enum", required: false, enum: ["today", "this_week", "flexible"] }
      }
    }
  ]
};
