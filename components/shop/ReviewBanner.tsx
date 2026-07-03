"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ReviewBannerItem {
  id: string;
  reviewerName: string;
  rating: number | null;
  body: string;
  productTitle?: string | null;
  notableTags?: string[] | null;
}

export interface ReviewBannerProps {
  reviews: ReviewBannerItem[];
  rotateMs?: number;
}

const HIDE_STORAGE_KEY = "shop:reviewBanner:hidden";

function StarRow({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  const full = "★".repeat(clamped);
  const empty = "☆".repeat(5 - clamped);
  return (
    <span aria-label={`${clamped} out of 5 stars`} className="text-amber-300">
      {full}
      <span className="text-amber-300/30">{empty}</span>
    </span>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => {
      mq.removeEventListener?.("change", update);
    };
  }, []);
  return reduced;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function ReviewBanner({
  reviews,
  rotateMs = 5000,
}: ReviewBannerProps) {
  const reducedMotion = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fade, setFade] = useState<"in" | "out">("in");
  const [hidden, setHidden] = useState(false);
  const [shuffled, setShuffled] = useState<ReviewBannerItem[]>(reviews);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shuffle on client mount so the banner doesn't always start with the same review.
  // Done in an effect to keep SSR output stable and avoid hydration mismatches.
  useEffect(() => {
    setShuffled(shuffle(reviews));
  }, [reviews]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(HIDE_STORAGE_KEY) === "1") {
        setHidden(true);
      }
    } catch {
      // localStorage unavailable; ignore
    }
  }, []);

  const total = shuffled.length;

  const advance = useCallback(() => {
    if (total <= 1) return;
    setFade("out");
    setTimeout(() => {
      setIdx((i) => (i + 1) % total);
      setFade("in");
    }, 220);
  }, [total]);

  useEffect(() => {
    if (reducedMotion) return;
    if (paused) return;
    if (hidden) return;
    if (total <= 1) return;
    intervalRef.current = setInterval(() => {
      advance();
    }, rotateMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [reducedMotion, paused, hidden, total, rotateMs, advance]);

  const safeIdx = total === 0 ? 0 : idx % total;
  const current = useMemo(() => shuffled[safeIdx] ?? null, [shuffled, safeIdx]);

  const handleHide = useCallback(() => {
    setHidden(true);
    try {
      window.localStorage.setItem(HIDE_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  if (total === 0) return null;
  if (hidden) return null;
  if (!current) return null;

  return (
    <div
      className="shop-review-banner relative mb-4 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-violet-500/5 to-transparent p-4 pr-8 backdrop-blur-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-live="polite"
      aria-roledescription="testimonials"
    >
      <button
        type="button"
        onClick={handleHide}
        aria-label="Hide reviews"
        title="Hide reviews"
        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/80"
      >
        <span aria-hidden="true" className="text-xs leading-none">×</span>
      </button>

      <div
        className={`transition-opacity duration-200 ${fade === "in" ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StarRow rating={current.rating} />
          <span className="font-bold text-white">{current.reviewerName}</span>
          {current.productTitle && (
            <span className="text-white/45">on “{current.productTitle}”</span>
          )}
        </div>
        <p className="shop-review-banner-body mt-1 text-sm italic text-white/80">
          “{current.body}”
        </p>
        {current.notableTags && current.notableTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {current.notableTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.6rem] text-white/65"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="absolute bottom-2 left-4 flex items-center gap-1.5">
          {shuffled.map((r, i) => {
            const isCurrent = i === safeIdx;
            if (reducedMotion) {
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Show review ${i + 1} of ${total}`}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`h-2 w-2 rounded-full transition ${
                    isCurrent ? "bg-purple-300" : "bg-white/25 hover:bg-white/45"
                  }`}
                />
              );
            }
            return (
              <span
                key={r.id}
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  isCurrent ? "bg-purple-300" : "bg-white/20"
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
