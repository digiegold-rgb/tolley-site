"use client";

import Image from "next/image";
import { useState } from "react";
import { GEN_IMAGES, GEN_MODEL } from "@/lib/generator";

export function GeneratorGallery() {
  const [current, setCurrent] = useState(0);
  const images = GEN_IMAGES;

  const prev = () => setCurrent((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setCurrent((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1030] overflow-hidden">
      <div className="p-6 pb-0 sm:p-8 sm:pb-0">
        <h2 className="gen-neon-text text-2xl font-black tracking-wide text-yellow-400 uppercase sm:text-3xl">
          Photos
        </h2>
        <p className="mt-1 text-sm font-light text-slate-400">
          {GEN_MODEL} — see it before you rent it.
        </p>
      </div>

      {/* Main image */}
      <div className="relative mx-6 mt-5 h-64 overflow-hidden rounded-lg bg-[#0a0e27] sm:mx-8 sm:h-80">
        <Image
          src={images[current]}
          alt={`${GEN_MODEL} - photo ${current + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 800px"
          priority={current === 0}
        />
        {/* Counter */}
        <span className="absolute top-3 right-3 z-10 rounded bg-black/60 px-2 py-1 text-xs font-bold text-white tabular-nums">
          {current + 1} / {images.length}
        </span>
        {/* Prev / Next */}
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
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto px-6 py-4 sm:px-8">
        {images.map((src, i) => (
          <button
            key={src}
            onClick={() => setCurrent(i)}
            className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md transition ${
              i === current
                ? "ring-2 ring-yellow-400"
                : "opacity-50 hover:opacity-80"
            }`}
          >
            <Image
              src={src}
              alt={`${GEN_MODEL} thumbnail ${i + 1}`}
              fill
              className="object-cover"
              sizes="80px"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
