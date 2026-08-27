/**
 * lib/vater/product.ts — which front door a studio user came through.
 *
 * ⚠️ ZERO IMPORTS. Used by proxy.ts (edge), auth routes, the signup page,
 * invite minting and the client shell. Keep it dependency-free.
 *
 *   jelly      → tolley.io/animate            ("Jelly! Studio")
 *   realestate → tolley.io/realestateanimated ("Listing Studio by Jelly!")
 *
 * Both products share auth, the credit ledger, Modal/fal lanes and /hq.
 * The product only changes branding, the default screen, the nav subset
 * and which compliance/end-card rules apply.
 */

export type Product = "jelly" | "realestate";

export const PRODUCTS: readonly Product[] = ["jelly", "realestate"] as const;

/** Signed-in home path per product (where "Back to studio" / Stripe returns land). */
export const STUDIO_HOME: Record<Product, string> = {
  jelly: "/animate",
  realestate: "/realestateanimated",
};

/** Human names — never put "Realtor" in a product name (NAR mark rules). */
export const PRODUCT_NAME: Record<Product, string> = {
  jelly: "Jelly! Studio",
  realestate: "Listing Studio by Jelly!",
};

/** LeadAction.subsite / invite-request discriminator per product. */
export const PRODUCT_SUBSITE: Record<Product, string> = {
  jelly: "animate",
  realestate: "realestate",
};

export function isProduct(v: unknown): v is Product {
  return v === "jelly" || v === "realestate";
}

/**
 * Product for a path (or callbackUrl). Longest prefix wins so
 * "/realestateanimated" never matches "/animate" by accident.
 * Returns null for non-studio paths.
 */
export function productForPath(path: string | null | undefined): Product | null {
  if (!path) return null;
  let p = path;
  try {
    // Accept absolute URLs too (Stripe/NextAuth callbackUrls are sometimes absolute).
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    /* keep raw */
  }
  if (p === "/realestateanimated" || p.startsWith("/realestateanimated/") || p.startsWith("/realestateanimated?")) {
    return "realestate";
  }
  if (p === "/animate" || p.startsWith("/animate/") || p.startsWith("/animate?")) {
    return "jelly";
  }
  return null;
}

/** True when the path belongs to either studio front door. */
export function isStudioPath(path: string | null | undefined): boolean {
  return productForPath(path) !== null;
}

/** Normalise an unknown origin value (DB column, cookie, query) to a Product. */
export function coerceProduct(v: unknown, fallback: Product = "jelly"): Product {
  return isProduct(v) ? v : fallback;
}
