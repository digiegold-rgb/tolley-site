/**
 * Shop listing boilerplate footer.
 *
 * Appends a standardized pickup/payment footer to every product description.
 * Uses a sentinel delimiter so the footer can be detected, stripped, and
 * re-applied without duplication (idempotent on re-analysis).
 */

const SENTINEL = "\n---\n";

export interface BoilerplateConfig {
  location: string;
}

export function getDefaultBoilerplate(): BoilerplateConfig {
  return {
    location: process.env.SHOP_BOILERPLATE_LOCATION || "Independence, MO",
  };
}

export function buildFooter(cfg: BoilerplateConfig = getDefaultBoilerplate()): string {
  const city = cfg.location.replace(/,\s*[A-Z]{2}\s*$/, "") || cfg.location;
  return [
    `Check out my seller profile for lots more deals. Save BIG!`,
    ``,
    `Cash or Venmo accepted. Pick up in ${city}.`,
  ].join("\n");
}

export function stripBoilerplate(description: string): string {
  const idx = description.indexOf(SENTINEL);
  if (idx === -1) return description;
  return description.slice(0, idx).trimEnd();
}

export function appendBoilerplate(
  description: string,
  cfg: BoilerplateConfig = getDefaultBoilerplate()
): string {
  const clean = stripBoilerplate(description).trimEnd();
  return `${clean}${SENTINEL}${buildFooter(cfg)}`;
}

export function hasBoilerplate(description: string): boolean {
  return description.includes(SENTINEL);
}
