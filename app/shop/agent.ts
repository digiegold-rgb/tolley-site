import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "shop",
  title: "Ruthann's Treasure Haul",
  purpose: "Curated vintage and reseller finds — Stripe Buy-Now checkout with shipping, FB Marketplace mirror, and Amazon affiliate picks; 215+ sold, 18 reviews.",
  url: "/shop",
  schemaType: "ItemList",
  jsonEndpoints: [],
  leadEndpoint: "/api/email-capture",
  leadSource: "shop",
  shareEndpoint: "/api/share",
  mcpTools: ["search_shop_items"],
  category: "product",
  status: "public",
  actions: [
    {
      verb: "request_shop_inquiry",
      description: "Ask a question about a specific shop item before buying.",
      fields: {
        itemId: { type: "string", required: true, description: "Shop item id" },
        question: { type: "string", required: true }
      }
    }
  ]
};
