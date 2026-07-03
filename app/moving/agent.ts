import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "moving",
  title: "Moving Supplies Bundle KC",
  purpose: "Moving box bundle rental + dolly/strap kits for KC-metro moves — reusable bins, cheaper than buying cardboard, delivered to your door.",
  url: "/moving",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "moving",
  shareEndpoint: "/api/share",
  mcpTools: ["get_moving_info"],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro",
  availability: "Drop within 48hr.",
  pricing: [
    { unit: "per day", amount: 49, currency: "USD", notes: "Standard bundle (40 bins + dolly)" },
    { unit: "per week", amount: 99, currency: "USD" },
    { unit: "two weeks", amount: 149, currency: "USD" }
  ],
  actions: [
    {
      verb: "request_moving_supplies",
      description: "Reserve a moving supplies bundle for a move date.",
      fields: {
        move_date: { type: "date", required: true },
        zip: { type: "zip", required: true },
        rental_length: { type: "enum", required: false, enum: ["day", "week", "two_weeks"] }
      }
    }
  ]
};
