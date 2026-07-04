// The Launchpad v2 — shared types + helpers for the operator platform
// (tolley.io/sales → /biz/<slug>). Storefronts are themed via lib/demo-site.ts;
// this module owns the offering shape, the Stripe metadata tag, slugging, and
// the demo-mode detector. Kept dependency-light so both server routes and the
// seed script can import it.

// Stripe checkout.session metadata.product tag → routed in the webhook switch
// to lib/launchpad-subscription.ts.
export const LAUNCHPAD_PRODUCT_METADATA = "launchpad";

// Demo storefronts (seed data) use slugs starting with this prefix; their
// checkout returns a notice instead of a live Stripe session so the demo
// account can be clicked through without creating real charges.
export const LAUNCHPAD_DEMO_PREFIX = "demo-";

export type OfferingKind = "one_time" | "monthly";

export interface Offering {
  name: string;
  desc?: string;
  priceCents: number;
  kind: OfferingKind;
}

/** Runtime-safe coercion of a Storefront.offerings JSON blob to Offering[]. */
export function parseOfferings(raw: unknown): Offering[] {
  if (!Array.isArray(raw)) return [];
  const out: Offering[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const priceCents =
      typeof o.priceCents === "number" && Number.isFinite(o.priceCents)
        ? Math.max(0, Math.round(o.priceCents))
        : 0;
    const kind: OfferingKind = o.kind === "monthly" ? "monthly" : "one_time";
    const desc = typeof o.desc === "string" ? o.desc.trim() : undefined;
    out.push({ name, desc: desc || undefined, priceCents, kind });
  }
  return out.slice(0, 6);
}

/** "$25" / "$25.50" / "$49/mo" — human price for an offering. */
export function formatOfferingPrice(o: Offering): string {
  const dollars = o.priceCents / 100;
  const money =
    dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
  return o.kind === "monthly" ? `${money}/mo` : money;
}

/** Business name → URL-safe kebab slug (no dedupe; caller handles collisions). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isDemoStorefrontSlug(slug: string): boolean {
  return slug.startsWith(LAUNCHPAD_DEMO_PREFIX);
}
