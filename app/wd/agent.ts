import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "wd",
  title: "Washer & Dryer Rental",
  purpose: "Rent a washer/dryer in the Kansas City metro for $59/mo (washer) or $99/mo (bundle) — delivery, install, and service included; no credit check, no long-term contract.",
  url: "/wd",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "wd",
  shareEndpoint: "/api/share",
  mcpTools: ["get_wd_pricing"],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro (Independence, KCMO, Olathe, Lees Summit, Overland Park)",
  availability: "Same-week delivery typical; same-day available for urgent requests.",
  pricing: [
    { unit: "monthly", amount: 59, currency: "USD", notes: "Washer only" },
    { unit: "monthly", amount: 99, currency: "USD", notes: "Washer + dryer bundle" }
  ],
  actions: [
    {
      verb: "request_wd_quote",
      description: "Request washer/dryer rental quote and delivery scheduling for a Kansas City address.",
      fields: {
        zip: { type: "zip", required: true, description: "Delivery ZIP", example: "64052" },
        unit_type: { type: "enum", required: true, enum: ["washer", "dryer", "bundle"], description: "What to rent" },
        desired_start: { type: "date", required: false, description: "ISO date when you want delivery", example: "2026-05-15" },
        notes: { type: "string", required: false, description: "Apartment/access notes" }
      }
    }
  ]
};
