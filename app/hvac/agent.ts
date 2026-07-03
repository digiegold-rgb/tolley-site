import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "hvac",
  title: "HVAC Service KC",
  purpose: "HVAC repair, install, and seasonal maintenance in the Kansas City metro — licensed, insured, 24/7 emergency dispatch.",
  url: "/hvac",
  schemaType: "LocalBusiness",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "hvac",
  shareEndpoint: "/api/share",
  mcpTools: ["get_hvac_services"],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro (50mi)",
  availability: "Same-day for urgent issues; install scheduling 3-5 days out.",
  pricing: [
    { unit: "service call", amount: 89, currency: "USD", notes: "Diagnostic, applied to repair if booked" }
  ],
  actions: [
    {
      verb: "request_hvac_service",
      description: "Schedule HVAC service. We call back within 30 minutes during business hours.",
      fields: {
        issue: { type: "enum", required: true, enum: ["no_cool", "no_heat", "noise", "leak", "install", "maintenance", "other"] },
        zip: { type: "zip", required: true },
        urgency: { type: "enum", required: false, enum: ["emergency", "today", "this_week", "flexible"] },
        notes: { type: "string", required: false, description: "Symptom details" }
      }
    }
  ]
};
