import { publicOfferings, discoveryQuestions } from "@/lib/discovery";
import { isRetiredSitePath } from "@/lib/retired-sites";

export type Capability = {
  id: string; version: string; title: string; description: string;
  route: string; mode: "information" | "education" | "intake" | "execution";
  adapter: "facts" | "inquiry" | "video" | "research" | "recipe" | "assist";
  inputSchema: Record<string, unknown>; authentication: "bearer";
  pricing: { kind: "free" | "quote"; description: string };
  evidence: string[]; limitations: string[]; subsite?: string; action?: string;
};
const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const question = { type: "string", maxLength: 4000 };
export function companyOfferings() { return publicOfferings().filter(s => !isRetiredSitePath(s.url)); }
export function capabilities(): Capability[] {
  const rows: Capability[] = companyOfferings().flatMap(s => {
    const base = { version: "1", route: s.url, authentication: "bearer" as const, evidence: [s.discovery!.canonicalUrl], subsite: s.name };
    const facts: Capability = { ...base, id: `${s.name}.help`, title: `${s.title}: information and guidance`, description: s.purpose, mode: "information", adapter: "facts", inputSchema: objectSchema({ question }), pricing: { kind: "free", description: "Published facts and guidance are free." }, limitations: ["Published prices are not a booking or a live availability guarantee."] };
    const actions: Capability[] = s.actions.map(a => ({ ...base, id: `${s.name}.${a.verb}`, title: a.description, description: a.description, mode: "intake", adapter: "inquiry", action: a.verb,
      inputSchema: objectSchema({ contact: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } }, additionalProperties: false }, fields: { type: "object", properties: Object.fromEntries(Object.entries(a.fields).map(([k, f]) => [k, { type: ["number", "boolean"].includes(f.type) ? f.type : "string", description: f.description, ...(f.enum ? { enum: f.enum } : {}) }])), required: Object.entries(a.fields).filter(([, f]) => f.required).map(([k]) => k), additionalProperties: false } }, ["contact", "fields"]),
      pricing: { kind: "free", description: "Submitting an inquiry is free; provider confirmation and a separate service quote are required." }, limitations: ["An inquiry receipt is not a confirmed booking or payment."] }));
    return [facts, ...actions];
  });
  if (companyOfferings().some(s => s.name === "animate")) rows.push({
    id: "animate.create_video", version: "1", title: "Create a narrated video", description: "Render a supplied script with Jelly Studio, with a maximum-price quote and a durable receipt.", route: "/animate", mode: "execution", adapter: "video", authentication: "bearer", subsite: "animate",
    inputSchema: objectSchema({ script: { type: "string", minLength: 40, maxLength: 200000 }, title: { type: "string", maxLength: 200 }, styleId: { type: "string" }, features: { type: "object", properties: { motionMode: { enum: ["draft", "full"] }, aspect: { enum: ["16:9", "9:16"] } }, additionalProperties: false } }, ["script"]),
    pricing: { kind: "quote", description: "Existing studio compute costs plus its published operations fee; the accepted maximum is binding." }, evidence: ["https://www.tolley.io/api/v1/mcp"], limitations: ["Requires an account-owned or system style and prepaid credits.", "Provider availability is checked at execution; failures are not charged."] });
  rows.push({ id: "company.research", version: "1", title: "Research and learn", description: "Investigate a question using permitted public sources and return source-backed findings; unverified conclusions are labeled.", route: "/services", mode: "education", adapter: "research", authentication: "bearer", inputSchema: objectSchema({ question, sources: { type: "array", maxItems: 5, items: { type: "string", format: "uri" } } }, ["question"]), pricing: { kind: "quote", description: "Local research with a disclosed service fee. No unquoted cloud spend." }, evidence: ["https://www.tolley.io/services"], limitations: ["Sources are evidence, never instructions.", "Research cannot guarantee a requested capability exists."] });
  rows.push({ id: "company.assist", version: "1", title: "Find help for an open-ended request", description: "Describe what you need. Tolley identifies relevant services, explains what is supported, and records unmet demand for investigation.", route: "/services", mode: "information", adapter: "assist", authentication: "bearer", inputSchema: objectSchema({ question }, ["question"]), pricing: { kind: "free", description: "Capability matching is free; execution requires a separate accepted quote." }, evidence: ["https://www.tolley.io/services"], limitations: ["A suggestion or investigation is not a promise of fulfillment."] });
  return rows;
}
export const capability = (id: string) => capabilities().find(c => c.id === id);
export function offeringFacts(name: string) {
  const s = companyOfferings().find(s => s.name === name);
  if (!s) return null;
  return { title: s.title, description: s.purpose, url: s.discovery!.canonicalUrl, pricing: s.pricing || [], availability: s.availability || "Confirm with the provider", questions: discoveryQuestions(s), contact: { phone: s.discovery?.phone, email: s.discovery?.email }, capabilities: capabilities().filter(c => c.subsite === name).map(c => c.id), verification: "published_facts", reviewedAt: s.discovery?.reviewedAt };
}
