import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "generator",
  title: "Generator Rental KC",
  purpose: "Honda EU7000iS inverter generator rental for events, jobsites, and emergency power — 5,500W running / 7,000W start, propane or gas, $89/day.",
  url: "/generator",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "generator",
  shareEndpoint: "/api/share",
  mcpTools: ["get_generator_info"],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro",
  availability: "Same-day if reserved by 2pm.",
  pricing: [
    { unit: "per day", amount: 89, currency: "USD" },
    { unit: "per week", amount: 449, currency: "USD" },
    { unit: "monthly", amount: 1499, currency: "USD" }
  ],
  actions: [
    {
      verb: "request_generator_quote",
      description: "Reserve a Honda inverter generator for a specific date.",
      fields: {
        event_date: { type: "date", required: true, example: "2026-05-20" },
        return_date: { type: "date", required: false },
        zip: { type: "zip", required: true },
        wattage_needed: { type: "number", required: false, description: "Estimated continuous watts" },
        fuel: { type: "enum", required: false, enum: ["gas", "propane", "either"] }
      }
    }
  ]
};
