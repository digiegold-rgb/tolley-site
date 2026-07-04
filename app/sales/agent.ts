import type { SubsiteManifest } from "@/lib/agent-manifest";

export const manifest: SubsiteManifest = {
  name: "sales",
  title: "The Launchpad — Start a Business With No License, No Bank, No Money",
  purpose:
    "Jared (Cordless/Tolley.io, Independence MO) gives people who can't start a business the normal way — no driver's license, no bank account, a record, no money — the platform to start anyway: an established LLC, a working Stripe account, a website live same-day, wholesale supplier accounts, trucks and equipment, and marketing automation, in exchange for a small cut while they're on the rails. Not a course, not a loan, not an MLM. A handshake deal that can end in a Buyout Button — the operator eventually owns the whole thing.",
  url: "/sales",
  schemaType: "Service",
  jsonEndpoints: [],
  leadEndpoint: "/api/lead/action",
  leadSource: "sales",
  shareEndpoint: "/api/share",
  mcpTools: [],
  category: "marketing",
  status: "public",
  skipJsonLd: false,
  serviceArea: "Kansas City metro (physical plays); nationwide for digital products run through the same rails.",
  availability: "Intake reviewed by Jared personally, handshake basis — not first-come/first-served, not automatic approval.",
  actions: [
    {
      verb: "launchpad_intake",
      description:
        "Submit an idea to start a business on Jared's platform (backbone LLC, Stripe/Plaid money rails, same-day website, supplier/logistics access). Jared reviews personally before anything is built.",
      fields: {
        idea: {
          type: "string",
          required: true,
          description: "The business idea, in the person's own words.",
          example: "I want to sell cleaning supply boxes to my neighbors monthly.",
        },
        business_name: {
          type: "string",
          required: true,
          description:
            "What to call the business — becomes the storefront name and the /biz/<slug> URL. An instant preview site is provisioned from this.",
          example: "Ridgeline Essentials Box",
        },
        category: {
          type: "enum",
          required: false,
          enum: [
            "generic",
            "auto",
            "nails",
            "hair",
            "lawn",
            "plumber",
            "bakery",
            "restaurant",
            "boutique",
            "contractor",
            "petgroomer",
          ],
          description:
            "Business type — picks the storefront theme (palette, fonts, copy). Defaults to 'generic'.",
        },
        city: {
          type: "string",
          required: false,
          description: "City the business serves. Shown on the storefront.",
          example: "Independence, MO",
        },
        offerings: {
          type: "string",
          required: false,
          description:
            "JSON array (1-3) of what they sell: [{name, desc, priceCents, kind:'one_time'|'monthly'}]. If blank, a single placeholder offering is seeded from the idea text.",
          example:
            '[{"name":"Monthly Essentials Box","priceCents":4500,"kind":"monthly"}]',
        },
        stopping: {
          type: "string",
          required: false,
          description:
            "Comma-separated list of what's stopping them today. Judgment-free multi-select codes: no_license, no_bank, record, money, dont_know_how, other.",
          example: "no_license, no_bank",
        },
        need_first: {
          type: "enum",
          required: true,
          enum: ["site", "supplies", "equipment", "customers", "all"],
          description: "What they think they need first to get moving.",
        },
        heard_about: {
          type: "string",
          required: false,
          description: "How they heard about Jared / the Launchpad.",
          example: "Facebook",
        },
      },
    },
  ],
};
