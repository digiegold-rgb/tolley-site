import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "agents",
  title: "Tolley.io AI Agents",
  purpose: "Build your own AI agents with custom prompts, tool access, webhooks, and phone/email bindings — Starter free, Pro $29/mo, Team $99/mo.",
  url: "/agents",
  schemaType: "SoftwareApplication",
  jsonEndpoints: ["/api/agents/public"],
  leadEndpoint: "/api/email-capture",
  leadSource: "agents",
  shareEndpoint: "/api/share",
  mcpTools: ["get_subsite_info"],
  category: "product",
  status: "auth",
  pricing: [
    { unit: "monthly", amount: 0, currency: "USD", notes: "Starter — 1 agent, 100 messages/mo" },
    { unit: "monthly", amount: 29, currency: "USD", notes: "Pro — 5 agents, 5K messages, webhooks, SMS" },
    { unit: "monthly", amount: 99, currency: "USD", notes: "Team — unlimited agents, 50K messages, phone routing" }
  ],
  actions: [
    {
      verb: "request_agents_signup",
      description: "Get started with Tolley.io AI Agents.",
      fields: {
        use_case: { type: "string", required: false, description: "What the agent will do" }
      }
    }
  ]
};
