import Image from "next/image";
import Link from "next/link";

export interface ReviewCardProduct {
  id: string;
  title: string;
  imageUrls: string[];
}

export interface ReviewCardData {
  id: string;
  reviewerName: string;
  reviewerAvatar?: string | null;
  rating?: number | null;
  body: string;
  notableTags: string[];
  reviewedAt?: Date | string | null;
  sourceUrl?: string | null;
  source: string;
  product?: ReviewCardProduct | null;
}

function formatReviewDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function StarRow({ rating }: { rating: number }) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      aria-label={`${safe} out of 5 stars`}
      className="text-amber-400 tracking-wide"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < safe ? "text-amber-400" : "text-white/15"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewCard({ review }: { review: ReviewCardData }) {
  const dateLabel = formatReviewDate(review.reviewedAt);
  const avatar = review.reviewerAvatar;
  const showStars = typeof review.rating === "number" && review.rating > 0;

  return (
    <article className="shop-card relative rounded-xl px-4 py-4 sm:px-5 sm:py-5">
      <header className="flex items-start gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={`${review.reviewerName} avatar`}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/40 to-violet-700/40 text-xs font-bold text-white/90 ring-1 ring-white/10"
          >
            {initials(review.reviewerName)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-bold text-white">
              {review.reviewerName}
            </span>
            {showStars && <StarRow rating={review.rating!} />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-wide text-white/40">
            {dateLabel && <span>{dateLabel}</span>}
            {dateLabel && review.source ? <span aria-hidden="true">·</span> : null}
            {review.source && <span>via {review.source}</span>}
            {review.sourceUrl && (
              <a
                href={review.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 hover:text-purple-200"
              >
                view source ↗
              </a>
            )}
          </div>
        </div>
      </header>

      <blockquote className="mt-3 text-sm italic leading-relaxed text-white/85">
        &ldquo;{review.body}&rdquo;
      </blockquote>

      {review.notableTags && review.notableTags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {review.notableTags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-purple-400/25 bg-purple-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-purple-200"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {review.product && (
        <Link
          href={`/shop?product=${review.product.id}`}
          className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[0.7rem] text-white/70 transition hover:border-white/25 hover:text-white"
        >
          {review.product.imageUrls?.[0] && (
            <span className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded">
              <Image
                src={review.product.imageUrls[0]}
                alt=""
                fill
                className="object-cover"
                sizes="32px"
              />
            </span>
          )}
          <span className="truncate">
            About: <span className="text-white/90">{review.product.title}</span>
          </span>
        </Link>
      )}
    </article>
  );
}
