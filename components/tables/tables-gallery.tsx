"use client";

import { useState } from "react";
import Image from "next/image";

import { TBL_IMAGES } from "@/lib/tables";

const images: readonly string[] = TBL_IMAGES;

export function TablesGallery() {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) return null;

  const prev = () => setIdx((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1e14] p-4 sm:p-6">
      <h2 className="tbl-neon-text mb-4 text-2xl font-black tracking-wide text-[#c8a84e] uppercase sm:text-3xl">
        Photos
      </h2>

      {/* Main image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black/30">
        <Image
          src={images[idx]}
          alt={`Tables & chairs photo ${idx + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 800px"
          priority={idx === 0}
        />

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={next}
              aria-label="Next photo"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <span className="absolute right-3 bottom-3 rounded bg-black/60 px-2 py-1 text-xs font-bold text-white">
              {idx + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIdx(i)}
              className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded border-2 transition sm:h-16 sm:w-24 ${
                i === idx ? "border-[#c8a84e]" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={src} alt={`Thumbnail ${i + 1}`} fill className="object-cover" sizes="96px" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
