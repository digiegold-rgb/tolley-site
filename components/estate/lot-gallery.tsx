"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The catalog. Sale photos rendered as numbered auction lots rather than a
 * thumbnail grid — the numbering is what makes it read as a catalog and not a
 * Facebook album, and it costs nothing to produce.
 *
 * Photos are wide-varied aspect ratios straight off a phone, so plates are
 * fixed-ratio with object-fit cover; the lightbox shows the true frame.
 */
export function LotGallery({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? null : (i + d + photos.length) % photos.length)),
    [photos.length]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // don't let the page scroll behind the lightbox
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, step]);

  if (!photos.length) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {photos.map((src, i) => (
          <button
            key={src}
            type="button"
            className="es-lot es-rise aspect-[4/5]"
            style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
            onClick={() => setOpen(i)}
            aria-label={`View lot ${String(i + 1).padStart(3, "0")}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Estate sale lot ${i + 1}`} loading={i < 8 ? "eager" : "lazy"} />
            <span className="es-lot-num">LOT {String(i + 1).padStart(3, "0")}</span>
          </button>
        ))}
      </div>

      {open !== null ? (
        <div
          className="es-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Lot ${String(open + 1).padStart(3, "0")}`}
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-5 top-5 text-2xl leading-none"
            style={{ color: "var(--es-cream-dim)" }}
            aria-label="Close"
          >
            ✕
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="es-carousel-arrow absolute left-3 top-1/2 -translate-y-1/2"
            aria-label="Previous lot"
          >
            ‹
          </button>

          <figure onClick={(e) => e.stopPropagation()} className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[open]} alt={`Estate sale lot ${open + 1}`} />
            <figcaption
              className="es-display mt-4 text-xs tracking-[0.24em] uppercase"
              style={{ color: "var(--es-brass)" }}
            >
              Lot {String(open + 1).padStart(3, "0")} — of {photos.length}
            </figcaption>
          </figure>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="es-carousel-arrow absolute right-3 top-1/2 -translate-y-1/2"
            aria-label="Next lot"
          >
            ›
          </button>
        </div>
      ) : null}
    </>
  );
}
