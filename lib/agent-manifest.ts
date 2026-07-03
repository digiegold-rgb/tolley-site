import { z } from "zod";

/**
 * SubsiteManifest — the per-route agent contract.
 *
 * Every public subsite under tolley.io exports one of these from
 * `app/<name>/agent.ts`. `lib/subsites.ts` aggregates them into the single
 * source of truth that powers /sitemap, /robots, /.well-known/agent-card.json,
 * /api/agent-index, /api/agent/[name], and the generic `get_subsite_info` MCP tool.
 *
 * `actions` is the transactional surface — each action is a verb an AI agent
 * can call via MCP `submit_subsite_action({subsite, action, contact, fields})`
 * or HTTP POST /api/lead/action. Each action results in a LeadAction row with
 * a receipt token so the agent can follow up.
 */

const FieldSpecSchema = z.object({
  type: z.enum(["string", "number", "boolean", "date", "email", "phone", "zip", "enum"]),
  required: z.boolean().optional(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  example: z.string().optional(),
});

export type SubsiteField = z.infer<typeof FieldSpecSchema>;

const SubsiteActionSchema = z.object({
  verb: z.string(),
  description: z.string(),
  fields: z.record(z.string(), FieldSpecSchema).default({}),
  resultExample: z.string().optional(),
});

export type SubsiteAction = z.infer<typeof SubsiteActionSchema>;

const PricingTierSchema = z.object({
  unit: z.string(),                  // "per day", "monthly", "annual", "one-time"
  amount: z.number(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
});

export type PricingTier = z.infer<typeof PricingTierSchema>;

export const SubsiteManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  purpose: z.string(),
  url: z.string().startsWith("/"),
  schemaType: z.enum([
    "WebPage",
    "Service",
    "Product",
    "Article",
    "LocalBusiness",
    "SoftwareApplication",
    "Organization",
    "FAQPage",
    "ItemList",
  ]).default("WebPage"),
  jsonEndpoints: z.array(z.string()).default([]),
  leadEndpoint: z.string().default("/api/email-capture"),
  leadSource: z.string(),
  shareEndpoint: z.string().default("/api/share"),
  mcpTools: z.array(z.string()).default([]),
  category: z.enum(["marketing", "product", "misc"]),
  status: z.enum(["public", "auth"]),
  skipJsonLd: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),

  // New: transactional + structured commerce data
  pricing: z.array(PricingTierSchema).optional(),
  availability: z.string().optional(),  // e.g. "Same-day in KC metro, 2-4 day elsewhere"
  serviceArea: z.string().optional(),   // e.g. "Kansas City metro (50mi)"
  actions: z.array(SubsiteActionSchema).default([]),
});

export type SubsiteManifest = z.infer<typeof SubsiteManifestSchema>;

export const ADMIN_ROUTES = [
  "/account",
  "/admin",
  "/content",
  "/credit",
  "/manus",
  "/media",
  "/social",
  "/trading",
] as const;

export function isAdminPath(path: string): boolean {
  return ADMIN_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

/**
 * Validate a structured-fields payload against an action's field spec.
 * Returns null on success, or an error string.
 */
export function validateActionFields(
  action: SubsiteAction,
  fields: Record<string, unknown>,
): string | null {
  for (const [key, spec] of Object.entries(action.fields)) {
    const value = fields[key];
    if (spec.required && (value === undefined || value === null || value === "")) {
      return `Missing required field: ${key}`;
    }
    if (value === undefined || value === null) continue;
    switch (spec.type) {
      case "email":
        if (typeof value !== "string" || !value.includes("@")) return `Invalid email: ${key}`;
        break;
      case "phone":
        if (typeof value !== "string" || value.replace(/\D/g, "").length < 7) return `Invalid phone: ${key}`;
        break;
      case "zip":
        if (typeof value !== "string" || !/^\d{5}(-\d{4})?$/.test(value)) return `Invalid zip: ${key}`;
        break;
      case "number":
        if (typeof value !== "number" && Number.isNaN(Number(value))) return `Invalid number: ${key}`;
        break;
      case "date":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return `Invalid date: ${key}`;
        break;
      case "enum":
        if (!spec.enum?.includes(String(value))) return `Invalid value for ${key}; expected one of ${spec.enum?.join(", ")}`;
        break;
      case "boolean":
        if (typeof value !== "boolean") return `Invalid boolean: ${key}`;
        break;
      case "string":
        if (typeof value !== "string") return `Invalid string: ${key}`;
        break;
    }
  }
  return null;
}
