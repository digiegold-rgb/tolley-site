"use client";

import { useState } from "react";
import { CRAZY, PHOTO_FILES } from "@/app/crazybins/data";

export function CrazyGallery() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section className="bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="crazy-enter text-center">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#e63946]">Recent Finds · Hallazgos Recientes</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#1d2d50] sm:text-5xl">
            Once it's gone, <span className="text-[#e63946]">it's GONE.</span>
          </h2>
          <p className="mt-3 text-base italic text-[#5b6b85]">¡Cuando se acaba, se acaba!</p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
          {PHOTO_FILES.map((file, i) => (
            <button
              key={file}
              type="button"
              onClick={() => setLightbox(`/crazybins/photos/${file}`)}
              className="crazy-tile crazy-enter group relative aspect-square overflow-hidden rounded-xl bg-orange-50 shadow-sm ring-1 ring-orange-100"
              style={{ "--enter-delay": `${(i % 12) * 0.04}s` } as React.CSSProperties}
            >
              <img
                src={`/crazybins/photos/${file}`}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-sm font-semibold text-[#5b6b85]">
          See more on{" "}
          <a href={CRAZY.brand.fbUrl} target="_blank" rel="noopener noreferrer" className="font-black text-[#1877F2] underline-offset-2 hover:underline">
            Facebook
          </a>
          {" — "}
          <strong className="text-[#1d2d50]">{CRAZY.brand.fbFollowers}</strong> already following
        </p>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-black text-[#e63946] shadow-lg hover:bg-yellow-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
