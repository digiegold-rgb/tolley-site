import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "shop",
  title: "Ruthann's Treasure Haul",
  purpose: "Consumer electronics, vintage, and reseller finds from Treasure Hauls. Browse current shop listings, item-specific checkout and fulfillment details, and Amazon affiliate picks.",
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
