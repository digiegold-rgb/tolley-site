"use client";

import { useEffect } from "react";
import { fbqEvent } from "@/components/analytics/meta-pixel";

/**
 * Fires Meta InitiateCheckout on /checkout mount. content_ids must match the
 * `id` column of /api/shop/meta-feed so the treasure-hauls dataset can
 * attribute checkouts to catalog items.
 */
export function InitiateCheckoutPixel({
  ids,
  value,
  numItems,
}: {
  ids: string[];
  value: number;
  numItems: number;
}) {
  useEffect(() => {
    fbqEvent("InitiateCheckout", {
      content_ids: ids,
      content_type: "product",
      value,
      currency: "USD",
      num_items: numItems,
    });
  }, [ids, value, numItems]);
  return null;
}
