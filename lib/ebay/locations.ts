/**
 * Inventory locations — eBay requires every offer to reference a
 * `merchantLocationKey`. We create one default location per seller from
 * EBAY_DEFAULT_LOCATION_ZIP and cache the key on EbayAuth.
 */

import { prisma } from "@/lib/prisma";
import { ebayFetch, EbayApiError } from "./client";

const DEFAULT_LOCATION_KEY = "default-location";

interface LocationPayload {
  location: {
    address: {
      country: "US";
      postalCode: string;
    };
  };
  locationInstructions?: string;
  name: string;
  merchantLocationStatus: "ENABLED";
  locationTypes: ["WAREHOUSE"];
}

export async function ensureDefaultLocation(): Promise<string> {
  const auth = await prisma.ebayAuth.findFirst({ orderBy: { updatedAt: "desc" } });
  if (auth?.defaultLocationKey) return auth.defaultLocationKey;

  const zip = process.env.EBAY_DEFAULT_LOCATION_ZIP || auth?.defaultLocationZip || "64052";
  const key = DEFAULT_LOCATION_KEY;

  const payload: LocationPayload = {
    location: { address: { country: "US", postalCode: zip } },
    name: "Default ship-from",
    merchantLocationStatus: "ENABLED",
    locationTypes: ["WAREHOUSE"],
  };

  try {
    await ebayFetch<void>(`/sell/inventory/v1/location/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // 409 = already exists, which is fine.
    if (!(err instanceof EbayApiError) || err.status !== 409) throw err;
  }

  if (auth) {
    await prisma.ebayAuth.update({
      where: { id: auth.id },
      data: { defaultLocationKey: key, defaultLocationZip: zip },
    });
  }
  return key;
}
