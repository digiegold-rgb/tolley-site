import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "water",
  title: "Pool Water Dashboard",
  purpose: "AI pool chemistry advisor with auto-dosing calculator and chemical cost tracker — log a reading, get a precise treatment plan.",
  url: "/water",
  schemaType: "SoftwareApplication",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "water",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: "Anywhere with a pool",
  pricing: [{ unit: "free", amount: 0, currency: "USD", notes: "Free dashboard; supplies via /pools" }],
  actions: [
    {
      verb: "request_water_advice",
      description: "Get a personalized chemistry plan for a pool issue.",
      fields: {
        gallons: { type: "number", required: true, description: "Pool capacity in gallons" },
        issue: { type: "string", required: true, description: "What is wrong (cloudy, green, low chlorine, etc.)" },
        last_reading: { type: "string", required: false, description: "FC / pH / TA / CYA values if known" }
      }
    }
  ]
};
