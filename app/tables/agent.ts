import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "tables",
  title: "Table & Chair Rental KC",
  purpose: "Folding tables and event chairs for parties, weddings, and pop-ups in the Kansas City metro — delivered + picked up.",
  url: "/tables",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "tables",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro",
  pricing: [
    { unit: "per day per 6ft table", amount: 12, currency: "USD" },
    { unit: "per day per chair", amount: 2, currency: "USD" }
  ],
  actions: [
    {
      verb: "book_tables",
      description: "Reserve tables and chairs for an event.",
      fields: {
        event_date: { type: "date", required: true },
        zip: { type: "zip", required: true },
        table_count: { type: "number", required: true },
        chair_count: { type: "number", required: false }
      }
    }
  ]
};
