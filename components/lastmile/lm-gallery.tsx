"use client";

import Image from "next/image";
import { useState } from "react";

import { LM_GALLERY_PHOTOS } from "@/lib/lastmile";

export function LmGallery() {
  const [current, setCurrent] = useState(0);
  const photos = LM_GALLERY_PHOTOS;

  const prev = () => setCurrent((c) => (c === 0 ? photos.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === photos.length - 1 ? 0 : c + 1));

  return (
    <section>
      <h2 className="lm-neon-text text-center text-3xl font-bold tracking-tight text-red-500 sm:text-4xl">
        On the Road
      </h2>
      <p className="mt-3 text-center text-neutral-400">
        Real jobs. Real loads. Every day across Kansas City.
      </p>

      <div className="mt-8">
        {/* Main image */}
        <div className="relative mx-auto aspect-[16/10] max-w-3xl overflow-hidden rounded-xl border border-red-500/15 bg-[#120808]">
          <Image
            src={photos[current].src}
            alt={photos[current].alt}
            fill
            className="object-cover transition-opacity duration-300"
          />

          {/* Prev */}
          <button
            onClick={prev}
            className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Previous photo"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next */}
          <button
            onClick={next}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Next photo"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Counter */}
          <div className="absolute right-3 bottom-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {current + 1} / {photos.length}
          </div>
        </div>

        {/* Thumbnails */}
        <div className="mx-auto mt-4 flex max-w-3xl gap-2 overflow-x-auto pb-2">
          {photos.map((photo, i) => (
            <button
              key={photo.src}
              onClick={() => setCurrent(i)}
              className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === current
                  ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={photo.src} alt={photo.alt} fill className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
