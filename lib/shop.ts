export const SHOP_CATEGORIES = [
  "Furniture",
  "Electronics",
  "Clothing",
  "Home",
  "Kitchen",
  "Kids",
  "Other",
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const FACEBOOK_PROFILE_URL =
  "https://www.facebook.com/profile.php?id=534686507";

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatPrice(price: number): string {
  return price % 1 === 0 ? `$${price}` : `$${price.toFixed(2)}`;
}
