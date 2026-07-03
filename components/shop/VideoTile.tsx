"use client";

import Image from "next/image";
import { useState } from "react";
import { formatPrice } from "@/lib/shop";
import ProductDetailModal, { type DetailItem } from "./ProductDetailModal";

export interface VideoTileProduct extends DetailItem {
  videoThumbnailUrl: string | null;
  videoDurationSec: number | null;
  status: string | null;
}

function formatDuration(sec: number | null): string | null {
  if (sec == null || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoTile({ product }: { product: VideoTileProduct }) {
  const [open, setOpen] = useState(false);

  const thumb =
    product.videoThumbnailUrl ||
    (product.imageUrls && product.imageUrls[0]) ||
    null;
  const duration = formatDuration(product.videoDurationSec);
  const sold = product.status === "sold";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Play video for ${product.title}`}
        className="group block w-full text-left"
      >
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10 transition group-hover:ring-purple-400/50">
          {thumb ? (
            <Image
              src={thumb}
              alt={product.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900/40 to-black/60">
              <span className="text-3xl text-white/60">▶</span>
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover:bg-black/30">
            <span className="rounded-full bg-black/60 p-2 text-white/90 backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-purple-500/80">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>

          {duration && (
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white/90">
              {duration}
            </span>
          )}

          {sold && (
            <span className="absolute left-1 top-1 rounded-full bg-rose-500/85 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-white">
              Sold
            </span>
          )}
        </div>

        <div className="mt-1.5 px-0.5">
          <h3 className="line-clamp-1 text-[0.7rem] font-semibold leading-snug text-white">
            {product.title}
          </h3>
          <span className="text-xs font-bold text-purple-300">
            {formatPrice(product.price)}
          </span>
        </div>
      </button>

      {open && (
        <ProductDetailModal
          item={product}
          onClose={() => setOpen(false)}
          amazonEnabled
          amazonTag="tolley-shop-20"
        />
      )}
    </>
  );
}
