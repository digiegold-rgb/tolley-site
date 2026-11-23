import type { SubsiteManifest } from "@/lib/agent-manifest";
import { TN_AREA, TN_EMAIL, TN_FAQ, TN_PHONE, TN_PURPOSE, TN_TITLE, TN_URL } from "@/lib/net";

export const manifest: SubsiteManifest = {
  name: "net",
  title: TN_TITLE,
  purpose: TN_PURPOSE,
  url: "/net",
  schemaType: "LocalBusiness",
  // The page emits LocalBusiness + Service JSON-LD. FAQPage comes from PublicOfferDetails.
  skipJsonLd: true,
  jsonEndpoints: [],
  leadEndpoint: "/api/net/quote",
  leadSource: "tolley-net",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  serviceArea: TN_AREA,
  keywords: [
    "home network setup",
    "gaming network",
    "UniFi install",
    "Wi-Fi",
    "Independence MO",
    "Kansas City",
    "fiber passthrough",
  ],
  faq: TN_FAQ,
  discovery: {
    disposition: "offering",
    canonicalUrl: TN_URL,
    reviewedAt: "2026-11-20",
    verification: "repository",
    operator: "Jared Tolley",
    phone: TN_PHONE,
    email: TN_EMAIL,
    evidence: [],
    pricingNote: "Free consult. Custom quote after consult.",
  },
  actions: [
    {
      verb: "request_network_consult",
      description:
        "Request a free phone consult for home or gaming network setup in the Kansas City area. A saved inquiry is not a price, a booking, or confirmed availability.",
      fields: {
        name: { type: "string", required: false },
        phone: { type: "phone", required: false },
        email: { type: "email", required: false },
        city: { type: "string", required: false, description: "City in or around Kansas City" },
        problem: { type: "string", required: false, description: "What is wrong with the network" },
        gaming: { type: "enum", enum: ["yes", "no"], required: false },
        devices: { type: "string", required: false, description: "Consoles, PCs, Fire TVs, and other devices" },
        preferredTime: { type: "string", required: false },
      },
    },
  ],
};
