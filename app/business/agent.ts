import type { SubsiteManifest } from "@/lib/agent-manifest";
import { BUSINESS_AREA, BUSINESS_DESCRIPTION, BUSINESS_EMAIL, BUSINESS_FAQ, BUSINESS_PRICING, BUSINESS_TITLE, BUSINESS_URL, BUSINESS_WORKFLOWS } from "@/lib/business";

export const manifest: SubsiteManifest = {
  name: "business", title: BUSINESS_TITLE, purpose: BUSINESS_DESCRIPTION, url: "/business",
  schemaType: "Service", skipJsonLd: true, category: "marketing", status: "public", serviceArea: BUSINESS_AREA,
  jsonEndpoints: [], leadEndpoint: "/api/lead/action", leadSource: "business", shareEndpoint: "/api/share", mcpTools: [],
  keywords: ["custom business software", "workflow automation", "small business software developer", "remote software development", "worldwide", "inventory software", "delivery paperwork automation", "invoice preparation", "internal tools", "AI document extraction", "customer portals"],
  faq: BUSINESS_FAQ,
  discovery: { disposition: "offering", canonicalUrl: BUSINESS_URL, reviewedAt: "2026-11-27", verification: "repository", operator: "Jared Tolley", email: BUSINESS_EMAIL, evidence: ["/post", "/shop", "/animate"], pricingNote: BUSINESS_PRICING },
  actions: [{
    verb: "request_business_project",
    description: "Ask Jared Tolley about a custom software or workflow automation project, remotely worldwide. Include reachable email or phone in contact and the required workflow fields. A saved inquiry is not a quote, booking, or payment authorization.",
    fields: {
      workflow: { type: "enum", required: true, enum: [...BUSINESS_WORKFLOWS.map(w => w.id), "other"], description: "The workflow to improve" },
      problem: { type: "string", required: true, description: "What happens today, where work gets stuck, and the desired improvement" },
      organization: { type: "string", description: "Business name and what it does" },
      country: { type: "string", description: "Customer country; remote inquiries welcome worldwide" },
      timeZone: { type: "string", description: "Time zone or city for arranging remote reviews" },
      tools: { type: "string", description: "Current spreadsheets, apps, documents, and systems" },
      frequency: { type: "string", description: "How often this happens and approximate time spent" },
      budget: { type: "string", description: "Optional budget including currency; not a quoted price" },
      timeline: { type: "string", description: "Desired timing, subject to agreement" },
    },
  }],
};
