import type { SubsiteManifest } from "@/lib/agent-manifest";
import { TC_FACEBOOK_URL } from "@/lib/cleanouts";

export const manifest: SubsiteManifest = {
  name: "cleanouts",
  title: "Tolley Cleanouts — Junk Removal & Estate Cleanouts KC",
  purpose:
    "Estate and rental cleanouts, junk and trash removal, furniture moving, and haul-away across the Kansas City metro. Free quotes, fast turnaround.",
  url: "/cleanouts",
  schemaType: "LocalBusiness",
  sameAs: [TC_FACEBOOK_URL],
  jsonEndpoints: [],
  leadEndpoint: "/api/cleanouts/quote",
  leadSource: "cleanouts",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: true,
  serviceArea: "Kansas City metro (Independence, KC, Lee's Summit, Blue Springs)",
  availability: "Free quotes; most jobs scheduled within days.",
  actions: [
    {
      verb: "request_cleanout_quote",
      description:
        "Request a free cleanout / junk-removal quote. We call or text back with a price.",
      fields: {
        name: { type: "string", required: true },
        phone: { type: "phone", required: true },
        address: { type: "string", required: false, description: "Job address or area" },
        details: {
          type: "string",
          required: true,
          description: "What needs hauled — rooms, items, access notes",
        },
      },
    },
  ],
};
