import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "pools",
  title: "Pool Supply Delivery KC",
  purpose: "Pool chemicals, parts, and accessories delivered to KC-metro homes at PoolCorp pricing — chlorine, shock, conditioner, equipment.",
  url: "/pools",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "pools",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro",
  availability: "Same-day in-metro.",
  actions: [
    {
      verb: "request_pool_delivery",
      description: "Request pool supply delivery. We confirm in-stock and price within an hour.",
      fields: {
        zip: { type: "zip", required: true },
        items: { type: "string", required: true, description: "What you need (e.g. 25lb chlorine tabs, 2 buckets shock)" },
        urgency: { type: "enum", required: false, enum: ["today", "this_week", "flexible"] }
      }
    }
  ]
};
