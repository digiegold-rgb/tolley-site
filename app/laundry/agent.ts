import type { SubsiteManifest } from "@/lib/agent-manifest";
import { BRAND, COMPANY, PHONE, EMAIL, BASE } from "@/lib/laundry/config";
export const manifest: SubsiteManifest = {
  name: "laundry",
  title: BRAND,
  purpose:
    "Find local washer and dryer rental operators by city or ZIP, compare prices and request delivery with an operator-specific signed agreement. KC-first marketplace expanding through approved operators.",
  url: "/laundry",
  schemaType: "Service",
  jsonEndpoints: ["/api/laundry/search"],
  leadEndpoint: "/laundry/request",
  leadSource: "laundry",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea:
    "Kansas City metro initially; search ZIP for approved operator coverage",
  availability:
    "Delivery dates and machine availability require operator confirmation.",
  actions: [],
  discovery: {
    disposition: "offering",
    canonicalUrl: `${BASE}/laundry`,
    reviewedAt: "2026-11-16",
    verification: "repository",
    operator: COMPANY,
    phone: PHONE,
    email: EMAIL,
    evidence: ["/laundry/operator-agreement"],
    pricingNote:
      "Free for renters to request service. Operator rental prices are shown before signing. Operators pay $45 per confirmed booking; affiliated KC anchor pays $0.",
  },
};
