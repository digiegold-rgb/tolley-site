import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "housing",
  title: "KC Housing Daily",
  purpose:
    "Daily Kansas City housing-market pulse — national rates + hyperlocal Independence/KC data, AI video brief, and a direct line to a local agent for home questions.",
  url: "/housing",
  schemaType: "Service",
  jsonEndpoints: ["/api/housing/pulse"],
  leadEndpoint: "/api/lead/action",
  leadSource: "housing",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: "Kansas City metro (KS + MO)",
  actions: [
    {
      verb: "ask_about_my_home",
      description:
        "Ask Jared (Your KC Homes) about your home's value, selling, buying, or investing in the KC market.",
      fields: {
        intent: {
          type: "enum",
          required: true,
          enum: ["selling", "buying", "curious_value", "investing"],
        },
        zip: { type: "zip", required: false, description: "Property ZIP" },
        address: { type: "string", required: false, description: "Property address (optional)" },
        timeline: {
          type: "enum",
          required: false,
          enum: ["asap", "30_days", "90_days", "exploring"],
        },
        notes: { type: "string", required: false },
      },
    },
    {
      verb: "bay_lead_import",
      description:
        "Internal: nightly import of Back At You landing-page leads into the HQ inbox.",
      fields: {
        bay_lead_id: { type: "string", required: true },
        bay_page: { type: "string", required: false },
        imported_at: { type: "string", required: false },
      },
    },
  ],
};
