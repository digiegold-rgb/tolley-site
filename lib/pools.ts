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
