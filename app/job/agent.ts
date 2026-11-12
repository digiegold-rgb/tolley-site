import type { SubsiteManifest } from "@/lib/agent-manifest";
import { JOB } from "@/lib/job";

export const manifest: SubsiteManifest = {
  name: "job", title: JOB.title, purpose: JOB.description,
  url: "/job", schemaType: "WebPage", jsonEndpoints: [],
  leadEndpoint: "/job#apply", leadSource: "job", shareEndpoint: "/api/share",
  mcpTools: [], category: "misc", status: "public", actions: [],
  serviceArea: JOB.location,
  discovery: {
    disposition: "supporting", canonicalUrl: "https://www.tolley.io/job",
    reviewedAt: "2026-11-11", verification: "repository", operator: "Jared Tolley",
    phone: JOB.phone, evidence: ["/job"],
    pricingNote: "Job pay: $28/hour, paid at the end of every workday. About 10 hours/week to start. Apply using the form, then send its prefilled text to Jared.",
  },
};
