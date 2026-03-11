"use client";

import { HVAC_REVIEWS } from "@/lib/hvac";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < rating ? "text-yellow-400" : "text-neutral-600"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: (typeof HVAC_REVIEWS)[number] }) {
  return (
    <div className="flex w-[300px] flex-shrink-0 flex-col rounded-xl border border-cyan-400/15 bg-[#0d1a2d] p-5">
      <div className="flex items-center justify-between">
        <StarRating rating={review.rating} />
        <span className="text-xs text-neutral-500">{review.timeAgo}</span>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-300">
        &ldquo;{review.text}&rdquo;
      </p>
      <p className="mt-4 text-sm font-bold text-white">{review.name}</p>
    </div>
  );
}

export function HvacReviews() {
  const doubled = [...HVAC_REVIEWS, ...HVAC_REVIEWS];

  return (
    <section className="w-full overflow-hidden py-10">
      <h2 className="hvac-neon-text text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
        What Customers Say
      </h2>
      <p className="mt-3 text-center text-neutral-400">
        4.7 stars from real Google reviews.
      </p>

      <div className="mt-8 overflow-x-hidden">
        <div className="hvac-review-track">
          {doubled.map((review, i) => (
            <ReviewCard key={`${review.name}-${i}`} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}
