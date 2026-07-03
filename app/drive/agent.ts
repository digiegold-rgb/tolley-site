import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "drive",
  title: "Red Alert Dispatch",
  purpose: "Real-time last-mile delivery dispatch — schedule pickups, see live driver fleet, track delivery status; serving the KC metro with same-day windows.",
  url: "/drive",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "drive",
  shareEndpoint: "/api/share",
  mcpTools: ["get_lastmile_info"],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro",
  availability: "Live dispatch 7am-9pm.",
  pricing: [
    { unit: "base", amount: 25, currency: "USD" },
    { unit: "per mile over 10", amount: 1.5, currency: "USD" }
  ],
  actions: [
    {
      verb: "request_delivery",
      description: "Request a last-mile delivery dispatch.",
      fields: {
        pickup_zip: { type: "zip", required: true },
        dropoff_zip: { type: "zip", required: true },
        weight_lbs: { type: "number", required: false },
        notes: { type: "string", required: false }
      }
    }
  ]
};
