"use client";

// CTA island for /v/[slug] watch pages — POSTs the slug to /api/v/checkout
// and redirects to the returned Stripe Checkout URL. Errors surface via the
// repo Toast pattern (never silent), mirroring DemoClaimBanner's handleBuy.

import { useState } from "react";

import { ToastProvider, useToast } from "@/components/ui/Toast";
import { DEMO_TOLLEY_PHONE } from "@/lib/demo-site";

function BuyButtonInner({ slug }: { slug: string }) {
  const { toast } = useToast();
  const [buying, setBuying] = useState(false);

  async function handleBuy() {
    if (buying) return;
    setBuying(true);
    try {
      const res = await fetch("/api/v/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || `Checkout failed (${res.status})`);
      }
      window.location.href = data.url;
    } catch (err) {
      setBuying(false);
      toast({
        title: "Couldn't start checkout",
        description:
          err instanceof Error
            ? err.message
            : `Call or text ${DEMO_TOLLEY_PHONE} instead.`,
        variant: "error",
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleBuy}
      disabled={buying}
      className="inline-flex items-center justify-center rounded-full bg-amber-400 px-8 py-3.5 text-base font-semibold text-[#1a1405] shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {buying ? "Starting checkout…" : "Make it yours — $250, delivered this week"}
    </button>
  );
}

export function VideoBuyButton({ slug }: { slug: string }) {
  // /v pages have no global ToastProvider (root layout doesn't mount one),
  // so this island brings its own — same pattern as DemoClaimBanner.
  return (
    <ToastProvider>
      <BuyButtonInner slug={slug} />
    </ToastProvider>
  );
}
