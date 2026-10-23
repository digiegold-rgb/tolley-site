import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "mortgage-calculator",
  title: "Free Mortgage Payment Calculator | T-Agent",
  purpose: "Estimate fixed-rate conventional, FHA, VA and USDA Guaranteed home purchase payments, including taxes, home insurance, PMI and program fees. Adjust price and down payment, view closing-cost and full-term estimates, and share a scenario. Free; no sign-in. Planning estimates, not loan offers or eligibility checks.",
  url: "/agent/calculator", schemaType: "WebPage", category: "product", status: "public",
  jsonEndpoints: [], leadEndpoint: "", leadSource: "mortgage-calculator", shareEndpoint: "", mcpTools: [], actions: [],
  discovery: { disposition: "supporting", canonicalUrl: "https://www.tolley.io/agent/calculator", reviewedAt: "2026-10-23", verification: "repository", evidence: [], pricingNote: "Free calculator; mortgage figures are estimates, not loan quotes." },
};
