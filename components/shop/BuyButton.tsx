"use client";

/**
 * Storefront CTAs — additive: every available channel is shown.
 *  - Stripe "Buy Now" (when itemId set): ships if shipPrice set, else local-pickup checkout.
 *  - "Buy on Amazon" affiliate (when amazonAsin set), tracked via /api/shop/amazon/[id].
 *  - "Find / Message on Facebook" — always shown (deep-link to listing or fallback to FB profile).
 *
 * `variant="sold"` disables Stripe + FB CTAs (visually muted) but keeps Amazon
 * affiliate CTAs ENABLED so sold cards still drive affiliate clicks.
 */
import { useState } from "react";
import {
  fbListingUrl,
  FACEBOOK_PROFILE_URL,
  formatPrice,
  amazonSearchUrl,
} from "@/lib/shop";
import { trackEvent } from "@/components/analytics/site-tracker";

interface Props {
  itemId?: string | null;
  title?: string | null;
  shipPrice?: number | null;
  fbListingId?: string | null;
  amazonAsin?: string | null;
  amazonTag?: string | null;
  amazonEnabled?: boolean;
  size?: "compact" | "full";
  variant?: "active" | "sold";
}

export default function BuyButton({
  itemId,
  title,
  shipPrice,
  fbListingId,
  amazonAsin,
  amazonTag,
  amazonEnabled = true,
  size = "compact",
  variant = "active",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSold = variant === "sold";
  const stripeAvailable = !!itemId;
  const ships = typeof shipPrice === "number" && shipPrice >= 0;
  const hasAmazon = amazonEnabled && !!amazonAsin && !!itemId;
  const searchTitle = title?.trim();
  // Show search fallback whenever we have a query to send. Prefer a tracked
  // redirect through /api/shop/amazon/search/[id] (so we can measure CTR);
  // fall back to inline tagged URL if no itemId is present.
  const showAmazonSearchFallback =
    amazonEnabled && !hasAmazon && !!searchTitle;
  const fallbackUrl = showAmazonSearchFallback
    ? itemId
      ? `/api/shop/amazon/search/${itemId}`
      : amazonSearchUrl(searchTitle, amazonTag)
    : null;
  const fbDirect = fbListingUrl(fbListingId);
  const fbUrl = fbDirect ?? FACEBOOK_PROFILE_URL;

  const padY = size === "full" ? "py-2.5" : "py-1.5";
  const text = size === "full" ? "text-sm" : "text-[0.7rem]";

  async function buy() {
    if (busy || isSold) return;
    setBusy(true);
    setErr(null);
    if (itemId) {
      trackEvent("shop", "buy_click", itemId, { dest: "stripe", ships });
    }
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  }

  const trackBuy = (dest: string) => {
    if (itemId) trackEvent("shop", "buy_click", itemId, { dest });
  };

  return (
    <div className="space-y-1.5">
      {stripeAvailable && !isSold && (
        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className={`shop-btn-primary block w-full rounded-md ${padY} text-center ${text} font-semibold disabled:opacity-50`}
        >
          {busy
            ? "Loading…"
            : ships
              ? `Buy Now${shipPrice && shipPrice > 0 ? ` + ${formatPrice(shipPrice)} ship` : " + Free Ship"}`
              : "Buy Now (Local Pickup)"}
        </button>
      )}

      {stripeAvailable && isSold && (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={`shop-btn-disabled block w-full rounded-md ${padY} text-center ${text} font-semibold`}
        >
          Sold
        </button>
      )}

      {hasAmazon && (
        <a
          href={`/api/shop/amazon/${itemId}?src=shop`}
          onClick={() => trackBuy("amazon_direct")}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className={`block w-full rounded-md bg-[#FF9900] ${padY} text-center ${text} font-semibold text-black hover:bg-[#ffb13a]`}
        >
          {isSold ? "Find Similar on Amazon" : "Buy on Amazon"}
          <span className="ml-1 text-[0.55rem] font-normal opacity-70">(paid link)</span>
        </a>
      )}

      {!hasAmazon && fallbackUrl && (
        <a
          href={
            fallbackUrl.startsWith("/api/")
              ? `${fallbackUrl}?src=shop`
              : fallbackUrl
          }
          onClick={() => trackBuy("amazon_search")}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className={`block w-full rounded-md bg-[#FF9900]/85 ${padY} text-center ${text} font-semibold text-black hover:bg-[#ffb13a]`}
        >
          Shop similar on Amazon
          <span className="ml-1 text-[0.55rem] font-normal opacity-70">(paid link)</span>
        </a>
      )}

      {!isSold && (
        <a
          href={fbUrl}
          onClick={() => trackBuy("facebook")}
          target="_blank"
          rel="noopener noreferrer"
          className={`shop-cta block w-full rounded-md ${padY} text-center ${text} font-semibold text-white`}
        >
          {fbDirect ? "Message on Facebook" : "Find on Facebook"}
        </a>
      )}

      {isSold && (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={`shop-btn-disabled block w-full rounded-md ${padY} text-center ${text} font-semibold`}
        >
          Sold on FB
        </button>
      )}

      {err && <p className="text-[0.6rem] text-red-300">{err}</p>}
    </div>
  );
}
