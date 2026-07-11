import type { SubsiteManifest } from "@/lib/agent-manifest";

// Mirrors DIRECTORY_GROUP_ORDER in lib/directory.ts. Inlined (not imported)
// because directory.ts imports subsites.ts, which imports this file — an
// import here would close that cycle.
const NEED_GROUPS = [
  "Start a Business",
  "Real Estate",
  "Home Services",
  "Rentals",
  "Hauling & Delivery",
  "Shop & Food",
  "AI & Ventures",
  "Events",
];

export const manifest: SubsiteManifest = {
  name: "circle",
  title: "The Tolley Circle",
  purpose:
    "The map of the whole Tolley.io network and the single capture point: visitors say what they need, become a tagged lead in HQ, and get routed to the right live service (real estate, rentals, home services, hauling, shop, AI).",
  url: "/circle",
  schemaType: "WebPage",
  jsonEndpoints: ["/api/circle/stats"],
  leadEndpoint: "/api/email-capture",
  leadSource: "circle",
  shareEndpoint: "/api/share",
  mcpTools: ["list_subsites"],
  category: "marketing",
  status: "public",
  actions: [
    {
      verb: "route-me",
      description:
        "Tell the circle what you need; creates a tagged lead in Tolley HQ and returns the right service to visit.",
      fields: {
        need: {
          type: "enum",
          required: true,
          enum: NEED_GROUPS,
          description: "Which part of the network the visitor needs",
        },
        product: {
          type: "string",
          required: true,
          description: "Subsite name of the chosen product, e.g. 'wd', 'homes', 'pools'",
        },
        note: {
          type: "string",
          description: "Anything else about what they're looking for",
        },
        ref: {
          type: "string",
          description: "Where they came from (referrer class or utm_source)",
        },
      },
      resultExample:
        '{"receiptToken":"abc123","status":"new","statusUrl":"https://www.tolley.io/api/lead/abc123"}',
    },
  ],
};
