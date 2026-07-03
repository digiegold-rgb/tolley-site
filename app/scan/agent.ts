import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "scan",
  title: "Scan & Know — Photo to Dossier",
  purpose: "Drop a photo of a property, person, or vehicle and get a fully-researched dossier — geolocation, public profiles, market data, OpenManus narrative.",
  url: "/scan",
  schemaType: "SoftwareApplication",
  jsonEndpoints: ["/api/scan/public"],
  leadEndpoint: "/api/email-capture",
  leadSource: "scan",
  shareEndpoint: "/api/share",
  mcpTools: ["get_subsite_info"],
  category: "product",
  status: "auth",
  pricing: [
    { unit: "per scan", amount: 0.99, currency: "USD" },
    { unit: "monthly", amount: 19, currency: "USD", notes: "Unlimited scans" }
  ],
  actions: [
    {
      verb: "request_scan_demo",
      description: "Get demo access to Scan & Know.",
      fields: {
        use_case: { type: "string", required: false }
      }
    }
  ]
};
