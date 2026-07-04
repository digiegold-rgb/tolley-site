"use client";

import { useState } from "react";

type Props = {
  slug: string;
  offering: string;
  priceLabel: string;
  sellingEnabled: boolean;
  phone: string | null; // tel: target for the locked "text to order" path
};

/**
 * Buy button for a Launchpad storefront offering. Locked (charcoal chip) until
 * Jared flips sellingEnabled; live (safety-orange) after. On click it hits
 * /api/biz/checkout and either redirects to Stripe, shows the demo notice, or
 * surfaces an error. Priced-at-$0 offerings render as a "text to order" link.
 */
export function BuyButton({ slug, offering, priceLabel, sellingEnabled, phone }: Props) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!sellingEnabled) {
    return (
      <div className="mt-4">
        <span className="biz-locked inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold">
          <span className="biz-locked-dot">●</span> Opens after the handshake
        </span>
        <p className="mt-2 text-xs opacity-70">
          This site is live, but ordering turns on once Jared says go.
        </p>
      </div>
    );
  }

  async function handleBuy() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/biz/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, offering }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        window.location.assign(data.url);
        return;
      }
      if (res.ok && data?.demo) {
        setNotice(data.notice || "Demo storefront — checkout is disabled here.");
        setLoading(false);
        return;
      }
      setError(
        (data && typeof data.error === "string" && data.error) ||
          "Couldn't start checkout — try again.",
      );
      setLoading(false);
    } catch {
      setError("Network error — try again in a moment.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleBuy}
        disabled={loading}
        className="biz-buy inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm shadow-lg"
      >
        {loading ? "Starting checkout…" : `Buy — ${priceLabel}`}
      </button>
      {notice && (
        <p className="biz-notice mt-3 rounded-lg px-3.5 py-2.5 text-sm">{notice}</p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-800/50 bg-red-100/40 px-3.5 py-2.5 text-sm text-red-900">
          {error}
          {phone ? (
            <>
              {" "}Or text{" "}
              <a href={`sms:${phone}`} className="underline underline-offset-2">
                {phone}
              </a>
              .
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
