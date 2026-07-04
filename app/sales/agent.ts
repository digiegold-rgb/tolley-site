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
        stopping: {
          type: "string",
          required: true,
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
