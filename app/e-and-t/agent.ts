import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "e-and-t",
  title: "13:13 Weddings & Events — Emily & Trevor Hawk",
  purpose:
    "Faith-led wedding coordination, planning, and officiant services in the Kansas City metro. Owned and run by Emily & Trevor Hawk (Lee's Summit, MO). Coordination packages from $650, full planning $1,500, certified officiant from $250.",
  url: "/e-and-t",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/lead/action",
  leadSource: "e-and-t",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: false,
  serviceArea:
    "Kansas City metro: Lee's Summit, Independence, Kansas City MO, Overland Park, Olathe, Blue Springs, Liberty.",
  availability:
    "Booking ceremonies, coordination, and full planning year-round. 13% off any package booked before June 13.",
  pricing: [
    { unit: "package", amount: 650, currency: "USD", notes: "Coordination Package One (day-of)" },
    { unit: "package", amount: 800, currency: "USD", notes: "Coordination Package Two" },
    { unit: "package", amount: 250, currency: "USD", notes: "Officiant services (starting)" },
    { unit: "package", amount: 1500, currency: "USD", notes: "Full Planning + Coordination package" },
  ],
  actions: [
    {
      verb: "request_wedding_consult",
      description:
        "Submit an inquiry for wedding coordination, planning, or officiant services with Emily & Trevor Hawk.",
      fields: {
        wedding_date: {
          type: "string",
          required: false,
          description: "Date or rough window for the wedding (free-form OK)",
          example: "September 21, 2026",
        },
        package: {
          type: "enum",
          required: true,
          enum: ["coordination", "officiant", "planning", "not_sure"],
          description: "Which service the couple is interested in",
        },
        venue: {
          type: "string",
          required: false,
          description: "Venue or city if known",
          example: "Lee's Summit, MO",
        },
        guest_count: {
          type: "string",
          required: false,
          description: "Rough guest count",
          example: "120",
        },
        message: {
          type: "string",
          required: false,
          description: "Anything else the couple wants Emily & Trevor to know",
        },
      },
    },
  ],
};
