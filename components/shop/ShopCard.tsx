"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { formatPrice, timeAgo } from "@/lib/shop";
import BuyButton from "./BuyButton";
import ProductDetailModal, { type DetailItem } from "./ProductDetailModal";

export interface ShopCardItem extends DetailItem {
  fbStatus: string | null;
}

export default function ShopCard({
  item,
  delay,
  amazonEnabled = true,
  amazonTag = null,
  variant = "active",
}: {
  item: ShopCardItem;
  delay: number;
  amazonEnabled?: boolean;
  amazonTag?: string | null;
  variant?: "active" | "sold";
}) {
  const [open, setOpen] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const created =
    typeof item.createdAt === "string" ? new Date(item.createdAt) : item.createdAt;
  const isSold = variant === "sold";
  const photos = item.imageUrls;
  const total = photos.length;

  function step(delta: number) {
    setPhotoIdx((i) => (i + delta + total) % total);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 30 || total <= 1) return;
    step(dx < 0 ? 1 : -1);
  }

  // Render dots inline; cap at 8 to avoid overflow on tiny cards
  const dotIndices = total <= 8
    ? Array.from({ length: total }, (_, i) => i)
    : null;

  return (
    <>
      <div
        className={`shop-card shop-enter rounded-lg ${isSold ? "shop-card-sold" : ""}`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {/* Image area — uses a div (not <button>) so the prev/next/dot
            <button>s nested inside don't violate HTML's no-nested-button rule
            (caused hydration errors). Click + Enter/Space open the modal. */}
        {total > 0 && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
              }
            }}
            aria-label={`View details for ${item.title}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="block w-full cursor-pointer text-left"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-white/5">
              <Image
                key={photos[photoIdx]}
                src={photos[photoIdx]}
                alt={`${item.title}${total > 1 ? ` (${photoIdx + 1} of ${total})` : ""}`}
                fill
                className="shop-card-img object-cover transition-opacity duration-200"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              />

              {isSold && (
                <span className="absolute left-1 top-1 z-10 rounded-full bg-emerald-700/85 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">
                  Sold
                </span>
              )}
              {item.videoUrl && !isSold && (
                <span className="absolute left-1 top-1 z-10 rounded-full bg-purple-500/85 px-1.5 py-0.5 text-[0.55rem] font-semibold text-white">
                  ▶ Video
                </span>
              )}
              {total > 1 && (
                <span className="pointer-events-none absolute right-1 top-1 z-10 rounded-full bg-black/65 px-1.5 py-0.5 text-[0.55rem] font-semibold text-white/90">
                  📷 {photoIdx + 1}/{total}
                </span>
              )}

              {/* Prev / Next arrows — only when multiple photos. Always
                  visible at 70% so touch users see them; full on hover. */}
              {total > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      step(-1);
                    }}
                    className="absolute left-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-base font-bold text-white opacity-70 transition hover:bg-black/85 hover:opacity-100"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      step(1);
                    }}
                    className="absolute right-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-base font-bold text-white opacity-70 transition hover:bg-black/85 hover:opacity-100"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Pagination dots */}
              {dotIndices && total > 1 && (
                <div className="pointer-events-auto absolute inset-x-0 bottom-1 z-10 flex justify-center gap-1">
                  {dotIndices.map((i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show photo ${i + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setPhotoIdx(i);
                      }}
                      className={`h-1.5 w-1.5 rounded-full ring-1 ring-black/40 transition-all ${
                        i === photoIdx ? "scale-125 bg-white" : "bg-white/55 hover:bg-white/80"
                      }`}
                    />
                  ))}
                </div>
              )}

              {item.fbStatus === "pending" && !isSold && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
                  <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-black">
                    Pending
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`View details for ${item.title}`}
          className="block w-full text-left"
        >
          <div className="px-2 pt-2">
            <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-white">
              {item.title}
            </h3>
            <div className="mt-1 flex items-center justify-between gap-1">
              <span className="text-sm font-bold text-purple-300">
                {formatPrice(item.price)}
              </span>
              <span className="text-[0.6rem] text-white/30">{timeAgo(created)}</span>
            </div>
          </div>
        </button>

        <div className="px-2 pb-2 pt-2">
          <BuyButton
            itemId={item.id}
            title={item.title}
            shipPrice={item.shipPrice}
            amazonAsin={item.amazonAsin}
            amazonTag={amazonTag}
            amazonEnabled={amazonEnabled}
            fbListingId={item.fbListingId}
            variant={variant}
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1.5 block w-full rounded-md border border-white/15 py-1 text-center text-[0.65rem] font-medium text-white/70 hover:border-white/30 hover:text-white"
          >
            {total > 1 ? `View all ${total} photos` : "View details"}
          </button>
        </div>
      </div>

      {open && (
        <ProductDetailModal
          item={item}
          initialPhotoIndex={photoIdx}
          onClose={() => setOpen(false)}
          amazonEnabled={amazonEnabled}
          amazonTag={amazonTag}
        />
      )}
    </>
  );
}
