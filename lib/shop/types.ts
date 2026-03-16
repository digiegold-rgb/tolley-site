export type ProductStatus = "draft" | "listed" | "sold" | "archived" | "returned";
export type ListingStatus = "draft" | "active" | "pending" | "sold" | "removed" | "expired";
export type LotStatus = "ordered" | "received" | "cataloging" | "listed" | "complete";
export type SourcingType = "liquidation" | "bin_store" | "thrift" | "wholesale" | "online_arbitrage";
export type Platform = "ebay" | "fb_marketplace" | "mercari" | "poshmark" | "offerup" | "amazon" | "shop";
export type CompPlatform = "ebay_sold" | "ebay_active" | "amazon" | "mercari" | "poshmark" | "offerup";
export type SignalType = "hot_category" | "price_spike" | "sell_through_high" | "seasonal_peak" | "viral";
export type AffiliateNetwork = "amazon_associates" | "ebay_partner" | "shareasale";
export type Condition = "new" | "like_new" | "good" | "fair" | "poor";

export const PLATFORMS: { value: Platform; label: string; color: string }[] = [
  { value: "ebay", label: "eBay", color: "#0064D2" },
  { value: "fb_marketplace", label: "FB Marketplace", color: "#1877F2" },
  { value: "mercari", label: "Mercari", color: "#E53935" },
  { value: "poshmark", label: "Poshmark", color: "#7F0353" },
  { value: "offerup", label: "OfferUp", color: "#00AB80" },
  { value: "amazon", label: "Amazon", color: "#FF9900" },
  { value: "shop", label: "tolley.io/shop", color: "#8B5CF6" },
];

export const SOURCING_TYPES: { value: SourcingType; label: string }[] = [
  { value: "liquidation", label: "Liquidation" },
  { value: "bin_store", label: "Bin Store" },
  { value: "thrift", label: "Thrift" },
  { value: "wholesale", label: "Wholesale" },
  { value: "online_arbitrage", label: "Online Arbitrage" },
];

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

export const PRODUCT_STATUSES: { value: ProductStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "#6B7280" },
  { value: "listed", label: "Listed", color: "#3B82F6" },
  { value: "sold", label: "Sold", color: "#22C55E" },
  { value: "archived", label: "Archived", color: "#9CA3AF" },
  { value: "returned", label: "Returned", color: "#EF4444" },
];
