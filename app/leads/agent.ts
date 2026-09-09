import { LEADS_TIERS } from "@/lib/leads-subscription";
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
  pricing: LEADS_TIERS.map(tier => ({
    unit: "monthly", amount: tier.price, currency: "USD",
    notes: `${tier.name} — ${tier.features.join(", ")}`,
  })),
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
