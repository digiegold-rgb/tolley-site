import { SUBSITES } from "./subsites";
import type { SubsiteManifest } from "./agent-manifest";
import { DISCOVERY_BASE } from "./discovery-facts";

export function publicOfferings() {
  return SUBSITES.filter(s => s.discovery?.disposition === "offering");
}
export function discoveryQuestions(s: SubsiteManifest): { q: string; a: string }[] {
  const questions = [{ q: `What does ${s.title} offer?`, a: s.purpose }];
  // A real, fact-bearing FAQ from the product's own constants beats the generic prompts below.
  if (s.faq?.length) {
    questions.push(...s.faq);
    questions.push({ q: "How do I get started?", a: s.discovery?.phone ? `Call or text ${s.discovery.phone} to discuss your needs and confirm pricing and availability.` : "Use the options on this page to view current details and take the next step." });
    return questions;
  }
  if (s.serviceArea) questions.push({ q: "Where is this available?", a: s.serviceArea + ". Confirm your address or requirements before booking." });
  if (s.name === "cleanouts" || s.name === "estate") questions.push({ q: "Can I arrange help while I am out of town?", a: "Contact Jared to discuss access, the scope of work, and how progress will be documented. If selling the property is also a goal, ask about a separate seller consultation." });
  if (s.name === "wd") questions.push({ q: "What should I check before renting?", a: "Confirm appliance dimensions, hookups, delivery access, installation, maintenance coverage, and the monthly total before booking. Ask separately about any purchase options." });
  if (s.name === "animate") questions.push({ q: "Can I see a finished video before signing up?", a: "Yes. The public demo is available at /animate/demo. Rendering uses prepaid credits; review the estimate and beta terms before starting." });
  if (["homes", "real-estate-agent", "housing"].includes(s.name)) questions.push({ q: "Can you help me prepare a home for sale?", a: "Ask Jared Tolley about a seller consultation, preparation priorities, and whether cleanout or estate sale services would be useful for your property. Confirm representation and service terms directly." });
  questions.push({ q: "How do I get started?", a: s.discovery?.phone ? `Call ${s.discovery.phone} to discuss your needs and confirm pricing and availability.` : "Use the options on this page to view current details and take the next step." });
  return questions;
}
export function discoveryMetadata(name: string) {
  const s = SUBSITES.find(s => s.name === name)!;
  return { title: s.title, description: s.purpose, alternates: { canonical: DISCOVERY_BASE + s.url } };
}
export function discoveryText(full = false) {
  const lines = ["# Tolley.io", "", "> Kansas City services, rentals, real estate, local commerce, and online creative tools.", "", "Public directory: https://www.tolley.io/services", "", "Facts below are drawn from the same registry as the public pages. Confirm availability and final prices with the named provider. Partner businesses have their own contacts.", ""];
  for (const s of publicOfferings()) {
    lines.push(`## ${s.title}`, `URL: ${s.discovery!.canonicalUrl}`, s.purpose);
    if (s.serviceArea) lines.push(`Service area: ${s.serviceArea}`);
    if (s.discovery?.phone) lines.push(`Phone: ${s.discovery.phone}`);
    if (s.discovery?.operator) lines.push(`Contact: ${s.discovery.operator}`);
    for (const p of s.pricing ?? []) lines.push(`Published price: ${p.currency} ${p.amount} ${p.unit}${p.notes ? ` — ${p.notes}` : ""}`);
    lines.push(s.discovery!.pricingNote);
    for (const link of s.discovery!.evidence) lines.push(`Examples: ${DISCOVERY_BASE}${link}`);
    if (full) for (const faq of discoveryQuestions(s)) lines.push(`Q: ${faq.q}`, `A: ${faq.a}`);
    lines.push("");
  }
  lines.push("## Developer discovery", "Jelly Studio API manifest: https://www.tolley.io/api/v1/mcp", "Agent index: https://www.tolley.io/api/agent-index", "Sitemap: https://www.tolley.io/sitemap.xml", "API access and paid actions require their documented authorization. A listing here does not authorize a transaction.");
  return lines.join("\n") + "\n";
}
/** FAQPage JSON-LD for an offering with a real FAQ; null when there is nothing quotable. */
export function discoveryFaqJsonLd(s: SubsiteManifest): Record<string, unknown> | null {
  if (!s.faq?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${DISCOVERY_BASE}${s.url}#faq`,
    mainEntity: s.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
