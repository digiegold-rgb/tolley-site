import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "food",
  title: "Ruthann's Kitchen",
  purpose: "Family meal planning, pantry tracking, recipe library, and Walmart + Sam's Club price comparison — $39/yr, 14-day trial.",
  url: "/food",
  schemaType: "SoftwareApplication",
  jsonEndpoints: ["/api/food/public"],
  leadEndpoint: "/api/email-capture",
  leadSource: "food",
  shareEndpoint: "/api/share",
  mcpTools: ["get_subsite_info"],
  category: "product",
  status: "auth",
  pricing: [{ unit: "annual", amount: 39, currency: "USD", notes: "14-day free trial" }],
  actions: [
    {
      verb: "request_food_trial",
      description: "Sign up to start a 14-day Ruthann's Kitchen trial.",
      fields: {
        household_size: { type: "number", required: false }
      }
    }
  ]
};
