import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "picnic-table",
  title: "Picnic Table Rental KC",
  purpose: "Picnic table rental for events and parties in the Kansas City metro — delivered, set up, picked up; $45/day per table.",
  url: "/picnic-table",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "picnic-table",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  availability: "Reserve 5+ days ahead for weekends.",
  pricing: [
    { unit: "per day per table", amount: 45, currency: "USD" },
    { unit: "weekly per table", amount: 175, currency: "USD" }
  ],
  actions: [
    {
      verb: "book_picnic_table",
      description: "Reserve picnic tables for an event date.",
      fields: {
        event_date: { type: "date", required: true },
        zip: { type: "zip", required: true },
        table_count: { type: "number", required: true },
        return_date: { type: "date", required: false }
      }
    }
  ]
};
