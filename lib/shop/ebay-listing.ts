/**
 * eBay Sell API integration for automated cross-posting.
 *
 * Requires eBay Developer Account:
 *   EBAY_APP_ID, EBAY_CERT_ID, EBAY_DEV_ID, EBAY_OAUTH_TOKEN
 *
 * Uses Inventory API (v1) for managed listings.
 */

const EBAY_API_BASE = process.env.EBAY_API_BASE || "https://api.ebay.com";
const EBAY_OAUTH_TOKEN = process.env.EBAY_OAUTH_TOKEN || "";

interface EbayListingInput {
  title: string;
  description: string;
  price: number;
  condition: "NEW" | "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE";
  category: string;
  imageUrls: string[];
  sku: string;
  quantity?: number;
}

interface EbayListingResult {
  listingId: string;
  offerId: string;
  url: string;
}

function headers() {
  return {
    Authorization: `Bearer ${EBAY_OAUTH_TOKEN}`,
    "Content-Type": "application/json",
    "Content-Language": "en-US",
  };
}

const CONDITION_MAP: Record<string, string> = {
  new: "NEW",
  like_new: "LIKE_NEW",
  good: "GOOD",
  fair: "ACCEPTABLE",
  poor: "ACCEPTABLE",
};

export function mapCondition(condition: string | null): string {
  return CONDITION_MAP[condition || ""] || "GOOD";
}

/**
 * Create an inventory item + offer on eBay.
 * Returns the listing URL once published.
 */
export async function createEbayListing(input: EbayListingInput): Promise<EbayListingResult> {
  if (!EBAY_OAUTH_TOKEN) {
    throw new Error("EBAY_OAUTH_TOKEN not configured — set up eBay Developer credentials");
  }

  // Step 1: Create/update inventory item
  const inventoryRes = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${input.sku}`,
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: {
            quantity: input.quantity || 1,
          },
        },
        condition: input.condition,
        product: {
          title: input.title,
          description: input.description,
          imageUrls: input.imageUrls,
        },
      }),
    }
  );

  if (!inventoryRes.ok && inventoryRes.status !== 204) {
    const err = await inventoryRes.text();
    throw new Error(`eBay inventory create failed: ${err}`);
  }

  // Step 2: Create offer
  const offerRes = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      sku: input.sku,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      listingDescription: input.description,
      availableQuantity: input.quantity || 1,
      pricingSummary: {
        price: {
          value: input.price.toFixed(2),
          currency: "USD",
        },
      },
      listingPolicies: {
        // These require pre-configured policies in eBay seller account
        // Users must set: fulfillmentPolicyId, paymentPolicyId, returnPolicyId
      },
    }),
  });

  if (!offerRes.ok) {
    const err = await offerRes.text();
    throw new Error(`eBay offer create failed: ${err}`);
  }

  const offer = await offerRes.json();
  const offerId = offer.offerId;

  // Step 3: Publish offer
  const publishRes = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}/publish`,
    {
      method: "POST",
      headers: headers(),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`eBay publish failed: ${err}`);
  }

  const published = await publishRes.json();

  return {
    listingId: published.listingId,
    offerId,
    url: `https://www.ebay.com/itm/${published.listingId}`,
  };
}

/**
 * Update an existing eBay listing's price/quantity.
 */
export async function updateEbayListing(
  offerId: string,
  updates: { price?: number; quantity?: number }
): Promise<void> {
  if (!EBAY_OAUTH_TOKEN) throw new Error("EBAY_OAUTH_TOKEN not configured");

  const body: Record<string, unknown> = {};
  if (updates.price !== undefined) {
    body.pricingSummary = {
      price: { value: updates.price.toFixed(2), currency: "USD" },
    };
  }
  if (updates.quantity !== undefined) {
    body.availableQuantity = updates.quantity;
  }

  const res = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`eBay update failed: ${err}`);
  }
}

/**
 * End (remove) an eBay listing.
 */
export async function endEbayListing(offerId: string): Promise<void> {
  if (!EBAY_OAUTH_TOKEN) throw new Error("EBAY_OAUTH_TOKEN not configured");

  const res = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}/withdraw`,
    {
      method: "POST",
      headers: headers(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`eBay withdraw failed: ${err}`);
  }
}
