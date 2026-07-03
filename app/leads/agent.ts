import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "leads",
  title: "T-Agent Lead Pipeline",
  purpose: "AI motivated-seller lead pipeline for real estate agents — weekly Monday digest, scoring, dossier synthesis, MLS-grid IDX/VOW; from $49/mo.",
  url: "/leads",
  schemaType: "SoftwareApplication",
  jsonEndpoints: ["/api/leads/public"],
  leadEndpoint: "/api/email-capture",
  leadSource: "leads",
  shareEndpoint: "/api/share",
  mcpTools: ["get_subsite_info"],
  category: "product",
  status: "auth",
  pricing: [
    { unit: "monthly", amount: 49, currency: "USD", notes: "Starter — 100 leads/mo, weekly digest" },
    { unit: "monthly", amount: 149, currency: "USD", notes: "Pro — 500 leads, daily digest, dossier synthesis, SMS auto-responder" },
    { unit: "monthly", amount: 499, currency: "USD", notes: "Team — unlimited leads, multi-agent" }
  ],
  actions: [
    {
      verb: "request_pipeline_demo",
      description: "Schedule a T-Agent Lead Pipeline demo.",
      fields: {
        brokerage: { type: "string", required: false },
        agent_count: { type: "number", required: false },
        market: { type: "string", required: false, description: "City/metro you operate in" }
      }
    }
  ]
};
