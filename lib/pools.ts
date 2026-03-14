export const POOLS_BRAND = "Pool Supply Delivery";
export const POOLS_COMPANY = "Your KC Homes LLC";
export const POOLS_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const POOLS_CONTACT_PHONE = "913-283-3826";

export const POOL_CATEGORIES = [
  "Chemicals",
  "Equipment",
  "Accessories",
  "Maintenance",
] as const;

export type PoolCategory = (typeof POOL_CATEGORIES)[number];

export function formatPoolPrice(price: number): string {
  return price % 1 === 0 ? `$${price}` : `$${price.toFixed(2)}`;
}

/** Build a manufacturer product-search URL for a given brand + part number */
export function getManufacturerUrl(brand: string | null, mfgPart: string): string {
  const q = encodeURIComponent(mfgPart);
  const b = (brand || "").toLowerCase();

  if (b.includes("pentair"))
    return `https://www.pentair.com/en-us/search.html?q=${q}`;
  if (b.includes("hayward"))
    return `https://www.hayward.com/catalogsearch/result/?q=${q}`;
  if (b.includes("jandy") || b.includes("zodiac"))
    return `https://www.jandy.com/en/search?q=${q}`;
  if (b.includes("raypak"))
    return `https://www.raypak.com/search/?q=${q}`;
  if (b.includes("polaris"))
    return `https://www.polarispool.com/en/search?q=${q}`;
  if (b.includes("sta-rite") || b.includes("starite"))
    return `https://www.sta-rite.com/en-us/search.html?q=${q}`;

  // Fallback: Google search
  const gq = encodeURIComponent(`${brand || ""} ${mfgPart}`.trim());
  return `https://www.google.com/search?q=${gq}`;
}
