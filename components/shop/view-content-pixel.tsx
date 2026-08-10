"use client";

import { useEffect } from "react";
import { fbqEvent } from "@/components/analytics/meta-pixel";

/**
 * Fires Meta ViewContent with the catalog product id on product-page mount.
 * content_ids must match the `id` column of /api/shop/meta-feed — this is
 * what lets the connected Commerce Manager dataset attribute page views to
 * catalog items (retargeting / dynamic ads).
 */
export function ViewContentPixel({
  id,
  name,
  value,
}: {
  id: string;
  name: string;
  value: number;
}) {
  useEffect(() => {
    fbqEvent("ViewContent", {
      content_ids: [id],
      content_type: "product",
      content_name: name,
      value,
      currency: "USD",
    });
  }, [id, name, value]);
  return null;
}
