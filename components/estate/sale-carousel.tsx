"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SaleCarouselData {
  slug: string;
  title: string;
  areaLabel: string;
  photos: string[];
  videoUrl: string | null;
}

type Slide = { kind: "video"; src: string } | { kind: "photo"; src: string };

const AUTOPLAY_MS = 4500;

export default function SaleCarousel({ sale }: { sale: SaleCarouselData }) {
  const slides: Slide[] = [
    ...(sale.videoUrl ? [{ kind: "video" as const, src: sale.videoUrl }] : []),
    ...sale.photos.map((src) => ({ kind: "photo" as const, src })),
  ];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchX = useRef<number | null>(null);

  const count = slides.length;
  const go = useCallback(
    (next: number) => setIndex((i) => (((next % count) + count) % count)),
    [count],
  );

  const current = slides[index];
  const onVideoSlide = current?.kind === "video";

  // Auto-advance — paused on hover, on the video slide, or when the tab is hidden.
  useEffect(() => {
    if (paused || onVideoSlide || count <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, onVideoSlide, count, index]);

  // Stop the video whenever we navigate away from its slide.
  useEffect(() => {
    if (!onVideoSlide && videoRef.current) videoRef.current.pause();
  }, [onVideoSlide]);

  if (count === 0) return null;

  return (
    <div
      className="es-sale-plate overflow-hidden p-3 sm:p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="es-kicker">The finds — new photos daily</p>
          <span className="text-xs" style={{ color: "var(--es-cream-dim)" }}>
            {index + 1} / {count}
          </span>
        </div>

        {/* Viewport */}
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded sm:aspect-[16/10]"
          style={{ background: "var(--es-panel)" }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
            touchX.current = null;
          }}
        >
          {current.kind === "video" ? (
            <video
              ref={videoRef}
              controls
              playsInline
              preload="metadata"
              poster={sale.photos[0]}
              className="h-full w-full bg-black object-contain"
            >
              <source src={current.src} type="video/mp4" />
            </video>
          ) : (
            <Link
              href={`/estate/sales/${sale.slug}`}
              className="block h-full w-full"
              aria-label="See all the finds"
            >
              <Image
                src={current.src}
                alt={`${sale.title} — find ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 900px"
                priority={index <= 1}
              />
            </Link>
          )}

          {/* Arrows */}
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous"
                className="es-carousel-arrow left-2"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next"
                className="es-carousel-arrow right-2"
              >
                ›
              </button>
            </>
          )}

          {/* Video badge on the first slide when not active-video */}
          {current.kind === "video" && (
            <span
              className="pointer-events-none absolute left-3 top-3 rounded px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-widest"
              style={{ background: "rgba(23,18,16,0.75)", color: "var(--es-brass-bright)" }}
            >
              ▶ Walkthrough
            </span>
          )}
        </div>

        {/* Dots */}
        {count > 1 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to ${s.kind} ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? "1.4rem" : "0.375rem",
                  background: i === index ? "var(--es-brass-bright)" : "var(--es-line)",
                }}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col items-center justify-between gap-3 px-1 sm:flex-row">
          <p className="text-sm" style={{ color: "var(--es-cream-dim)" }}>
            📍 {sale.areaLabel} · exact address released early Friday
          </p>
          <Link href={`/estate/sales/${sale.slug}`} className="es-btn-primary px-6 py-2.5 text-sm">
            See all {sale.photos.length} finds &amp; details →
          </Link>
        </div>
      </div>
    </div>
  );
}
