/**
 * eBay Sell Inventory API — create inventory items, create offers,
 * and (optionally) publish.
 *
 * For the parallel-draft workflow we deliberately STOP at "create offer".
 * The unpublished offer behaves like a draft: it lives in the seller's
 * Seller Hub → Drafts/Offers area until the user clicks Publish.
 */

import { ebayFetch } from "./client";

export type EbayCondition =
  | "NEW"
  | "LIKE_NEW"
  | "NEW_OTHER"
  | "USED_EXCELLENT"
  | "USED_VERY_GOOD"
  | "USED_GOOD"
  | "USED_ACCEPTABLE";

const CONDITION_MAP: Record<string, EbayCondition> = {
  new: "NEW",
  like_new: "LIKE_NEW",
  good: "USED_GOOD",
  fair: "USED_ACCEPTABLE",
  poor: "USED_ACCEPTABLE",
};

export function mapCondition(condition: string | null | undefined): EbayCondition {
  return CONDITION_MAP[condition ?? ""] ?? "USED_GOOD";
}

export interface InventoryItemInput {
  sku: string;
  title: string;
  description: string;
  imageUrls: string[];
  condition: EbayCondition;
  quantity?: number;
  /**
   * Item specifics / aspects — keys are eBay aspect names like "Brand",
   * "Color", "Size". Values must be string arrays per the API spec.
   */
  aspects?: Record<string, string[]>;
  brand?: string;
  mpn?: string;
}

export interface OfferInput {
  sku: string;
  /** USD price as a number — formatted to 2 decimals before send. */
  price: number;
  categoryId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  fulfillmentPolicyId: string;
  merchantLocationKey: string;
  description: string;
  quantity?: number;
}

export interface OfferResult {
  offerId: string;
}

const MARKETPLACE = "EBAY_US";

/**
 * PUT /sell/inventory/v1/inventory_item/{sku}
 * Idempotent — calling again with the same sku updates the item.
 */
export async function upsertInventoryItem(input: InventoryItemInput): Promise<void> {
  const body: Record<string, unknown> = {
    availability: {
      shipToLocationAvailability: {
        quantity: input.quantity ?? 1,
      },
    },
    condition: input.condition,
    product: {
      title: input.title.slice(0, 80),
      description: input.description,
      imageUrls: input.imageUrls.slice(0, 24),
      ...(input.aspects && Object.keys(input.aspects).length > 0
        ? { aspects: input.aspects }
        : {}),
      ...(input.brand ? { brand: input.brand } : {}),
      ...(input.mpn ? { mpn: input.mpn } : {}),
    },
  };

  await ebayFetch<void>(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * POST /sell/inventory/v1/offer — creates an UNPUBLISHED offer (draft).
 * Returns the offerId you'd use to later publish or update.
 */
export async function createOffer(input: OfferInput): Promise<OfferResult> {
  const body = {
    sku: input.sku,
    marketplaceId: MARKETPLACE,
    format: "FIXED_PRICE",
    listingDescription: input.description,
    availableQuantity: input.quantity ?? 1,
    categoryId: input.categoryId,
    pricingSummary: {
      price: { value: input.price.toFixed(2), currency: "USD" },
    },
    listingPolicies: {
      paymentPolicyId: input.paymentPolicyId,
      returnPolicyId: input.returnPolicyId,
      fulfillmentPolicyId: input.fulfillmentPolicyId,
    },
    merchantLocationKey: input.merchantLocationKey,
  };

  const res = await ebayFetch<{ offerId: string }>(`/sell/inventory/v1/offer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { offerId: res.offerId };
}

/** POST /sell/inventory/v1/offer/{offerId}/publish — promotes draft to live listing. */
export async function publishOffer(offerId: string): Promise<{ listingId: string }> {
  const res = await ebayFetch<{ listingId: string }>(
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
    { method: "POST" }
  );
  return { listingId: res.listingId };
}

/** POST /sell/inventory/v1/offer/{offerId}/withdraw — ends a published offer. */
export async function withdrawOffer(offerId: string): Promise<void> {
  await ebayFetch<void>(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, {
    method: "POST",
  });
}

/** PUT /sell/inventory/v1/offer/{offerId} — partial update for price/quantity. */
export async function updateOffer(
  offerId: string,
  patch: { price?: number; quantity?: number }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.price !== undefined) {
    body.pricingSummary = { price: { value: patch.price.toFixed(2), currency: "USD" } };
  }
  if (patch.quantity !== undefined) {
    body.availableQuantity = patch.quantity;
  }
  await ebayFetch<void>(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * Build a deep link to the seller's drafts/offers tab so the user can
 * review the unpublished offer.
 */
export function offerDraftUrl(offerId: string): string {
  return `https://www.ebay.com/sl/sell/draft?offerId=${encodeURIComponent(offerId)}`;
}
