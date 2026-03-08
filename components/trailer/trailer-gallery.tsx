"use client";

import Image from "next/image";
import { useState } from "react";

export function TrailerGallery({
  images,
  alt,
  size,
}: {
  images: readonly string[];
  alt: string;
  size: string;
}) {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setCurrent((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="relative">
      {/* Main image */}
      <div className="relative h-56 bg-neutral-950 sm:h-64">
        <Image
          src={images[current]}
          alt={`${alt} - photo ${current + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 50vw"
          priority={current === 0}
        />
        {/* Size badge */}
        <span className="absolute top-3 left-3 z-10 rounded bg-amber-500 px-3 py-1 text-sm font-black tracking-wide text-black uppercase">
          {size}
        </span>
        {/* Counter */}
        <span className="absolute top-3 right-3 z-10 rounded bg-black/60 px-2 py-1 text-xs font-bold text-white tabular-nums">
          {current + 1} / {images.length}
        </span>
        {/* Prev / Next */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>
      {/* Thumbnails */}
      <div className="flex gap-1 overflow-x-auto bg-neutral-950 p-2">
        {images.map((src, i) => (
          <button
            key={src}
            onClick={() => setCurrent(i)}
            className={`relative h-12 w-16 flex-shrink-0 overflow-hidden rounded transition ${
              i === current
                ? "ring-2 ring-amber-500"
                : "opacity-50 hover:opacity-80"
            }`}
          >
            <Image
              src={src}
              alt={`${alt} thumbnail ${i + 1}`}
              fill
              className="object-cover"
              sizes="64px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
