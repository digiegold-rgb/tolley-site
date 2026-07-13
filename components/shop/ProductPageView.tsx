"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatPrice, timeAgo } from "@/lib/shop";
import { trackEvent } from "@/components/analytics/site-tracker";
import BuyButton from "./BuyButton";
import type { DetailItem } from "./ProductDetailModal";

export interface ProductPageItem extends DetailItem {
  status: string;
}

/**
 * Standalone product page body — same two-column gallery/detail layout as
 * ProductDetailModal, but rendered in-page (no overlay) so /shop/[id] deep
 * links from FB posts, /go redirects, and Google land on a real page.
 */
export default function ProductPageView({
  item,
  amazonEnabled = true,
  amazonTag = null,
}: {
  item: ProductPageItem;
  amazonEnabled?: boolean;
  amazonTag?: string | null;
}) {
  const total = item.imageUrls.length;
  const [idx, setIdx] = useState(0);
  const isSold = item.status === "sold";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && total > 1) setIdx((i) => (i - 1 + total) % total);
      if (e.key === "ArrowRight" && total > 1) setIdx((i) => (i + 1) % total);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  // One product_view event per page load — same event the grid modal fires,
  // so /hq stats see modal and page views identically.
  useEffect(() => {
    trackEvent("shop", "product_view", item.id, {
      title: item.title,
      category: item.category,
      price: item.price,
      surface: "page",
    });
  }, [item.id, item.title, item.category, item.price]);

  const created =
    typeof item.createdAt === "string" ? new Date(item.createdAt) : item.createdAt;

  return (
    <div className="shop-card rounded-xl">
      <div className="grid gap-0 md:grid-cols-2">
        {/* Gallery — video above carousel when present */}
        <div className="relative bg-black/30">
          {item.videoUrl && (
            <div className="aspect-square w-full bg-black md:aspect-auto md:h-[280px]">
              <video
                src={item.videoUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
                preload="metadata"
              />
            </div>
          )}
          {total > 0 ? (
            <div className="relative aspect-square w-full overflow-hidden md:aspect-auto md:h-full md:min-h-[400px]">
              <Image
                key={item.imageUrls[idx]}
                src={item.imageUrls[idx]}
                alt={`${item.title} ${idx + 1}/${total}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
              {isSold && (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-emerald-700/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Sold
                </span>
              )}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => setIdx((i) => (i - 1 + total) % total)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => setIdx((i) => (i + 1) % total)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] text-white/80">
                    {idx + 1} / {total}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center text-white/30">
              No photo
            </div>
          )}

          {total > 1 && (
            <div className="flex gap-1 overflow-x-auto bg-black/30 p-2">
              {item.imageUrls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded ${
                    i === idx ? "ring-2 ring-purple-400" : "opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`Photo ${i + 1}`}
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="48px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="flex flex-col gap-3 p-5">
          <h1 className="text-xl font-bold text-white">{item.title}</h1>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-purple-300">
              {formatPrice(item.price)}
            </span>
            {typeof item.shipPrice === "number" && !isSold && (
              <span className="text-xs text-white/60">
                + {formatPrice(item.shipPrice)} shipping
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-wide text-white/40">
            {item.category && <span>{item.category}</span>}
            <span>· Listed {timeAgo(created)}</span>
          </div>

          {isSold && (
            <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-200">
              This one sold locally — but you can still grab it (or something
              close) on Amazon below, or browse the latest finds.
            </p>
          )}

          {item.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
              {item.description}
            </p>
          )}

          <div className="mt-2">
            <BuyButton
              itemId={item.id}
              title={item.title}
              shipPrice={item.shipPrice}
              amazonAsin={item.amazonAsin}
              amazonTag={amazonTag}
              amazonEnabled={amazonEnabled}
              fbListingId={item.fbListingId}
              size="full"
              variant={isSold ? "sold" : "active"}
            />
          </div>

          <p className="mt-1 text-[0.65rem] text-white/40">
            Local pickup in the Kansas City metro · ← → to flip photos
          </p>
        </div>
      </div>
    </div>
  );
}
