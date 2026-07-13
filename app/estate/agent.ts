import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "estate",
  title: "Tolley Estate Sales — Full-Service Estate Sales in Kansas City",
  purpose:
    "Full-service estate sales in Independence and the Kansas City metro: free walkthrough, we stage, price, advertise, and run the sale, then settle fast. Leftovers can keep selling through our resale shop. Operated by Jared Tolley under Your KC Homes LLC.",
  url: "/estate",
  schemaType: "LocalBusiness",
  jsonEndpoints: [],
  leadEndpoint: "/api/lead/action",
  leadSource: "estate",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  // LocalBusiness + Event (sale dates) JSON-LD is hand-rolled in the page —
  // Event isn't representable in the manifest schema enum.
  skipJsonLd: true,
  serviceArea: "Kansas City metro (Independence, Blue Springs, Lee's Summit, KCMO)",
  availability:
    "Next sale: Fri–Sat July 17–18, 2026, 8am–4pm, Independence MO. Free seller walkthroughs booked within days.",
  actions: [
    {
      verb: "request_estate_consult",
      description:
        "Book a free, no-obligation estate sale walkthrough. Jared calls or texts back, usually same day.",
      fields: {
        name: { type: "string", required: true },
        phone: { type: "phone", required: false },
        email: { type: "email", required: false },
        city: { type: "string", required: false, description: "Property city/area" },
        situation: {
          type: "enum",
          required: false,
          enum: ["downsizing", "estate_settlement", "moving", "cleanout_only", "other"],
          description: "What's prompting the sale",
        },
        timeframe: {
          type: "enum",
          required: false,
          enum: ["asap", "this_month", "1_3_months", "exploring"],
        },
        details: {
          type: "string",
          required: false,
          description: "Anything about the home or its contents",
        },
      },
    },
  ],
};
