import type { Product } from "./product";

/** Listing Studio is self-service through an email-locked signup link.
 * Jelly retains its configured paid-source approval policy. */
export function shouldAutoApproveInvite(
  product: Product,
  source: string | undefined,
  allowedSources = "fb,facebook,ig,instagram,meta",
): boolean {
  if (product === "realestate") return true;
  const normalizedSource = source?.trim().toLowerCase();
  if (!normalizedSource) return false;
  const allowed = allowedSources.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes("*") || allowed.includes(normalizedSource);
}
