"use client";

import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/components/analytics/site-tracker";
import { gtagEvent } from "@/components/analytics/ga4";
import { fbqEvent } from "@/components/analytics/meta-pixel";

interface WdCheckoutLinkProps {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Checkout CTA that:
 * 1. Passes ?promo= / ?code= URL param as Stripe prefilled_promo_code
 * 2. Fires internal + GA4 + Meta Pixel events on click
 */
export function WdCheckoutLink({ href, label, children, className }: WdCheckoutLinkProps) {
  const params = useSearchParams();
  const promo = params.get("promo") || params.get("code") || null;

  const finalHref = promo
    ? `${href}${href.includes("?") ? "&" : "?"}prefilled_promo_code=${encodeURIComponent(promo)}`
    : href;

  function handleClick() {
    trackEvent("wd", "checkout_click", label, { promo: promo || "none" });
    gtagEvent("begin_checkout", { item_name: label, coupon: promo || "" });
    fbqEvent("InitiateCheckout", { content_name: label });
  }

  return (
    <a
      href={finalHref}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
