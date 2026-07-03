import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "lastmile",
  title: "Last-Mile Delivery KC",
  purpose: "Same-day last-mile courier service in the Kansas City metro — small businesses, e-comm, and individuals; commercial vehicle, insured driver, $25 base.",
  url: "/lastmile",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "lastmile",
  shareEndpoint: "/api/share",
  mcpTools: ["get_lastmile_info"],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  availability: "Same-day pickup window 9am-7pm; book 2hr ahead.",
  pricing: [
    { unit: "base delivery", amount: 25, currency: "USD" },
    { unit: "per mile over 10", amount: 1.5, currency: "USD" }
  ],
  actions: [
    {
      verb: "request_delivery_quote",
      description: "Get a last-mile delivery quote and dispatch.",
      fields: {
        pickup_zip: { type: "zip", required: true },
        dropoff_zip: { type: "zip", required: true },
        weight_lbs: { type: "number", required: false },
        urgency: { type: "enum", required: false, enum: ["asap", "today", "scheduled"] },
        notes: { type: "string", required: false }
      }
    }
  ]
};
