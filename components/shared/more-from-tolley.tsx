import Image from "next/image";
import Link from "next/link";
import { crossSell } from "@/lib/directory";

/**
 * "More from Tolley" — a compact cross-sell strip that turns any SEO-island
 * subsite into a funnel into the rest of the network. Server component; drops
 * in above/below a page's existing footer. Picks sibling services first, always
 * excludes the current page, and links to the full /start directory.
 *
 *   <MoreFromTolley currentSubsite="pools" />
 */
export function MoreFromTolley({
  currentSubsite,
  count = 4,
  className = "",
}: {
  currentSubsite: string;
  count?: number;
  className?: string;
}) {
  const picks = crossSell(currentSubsite, count);
  if (picks.length === 0) return null;

  return (
    <section
      className={`border-t border-white/10 bg-neutral-950 px-5 py-10 ${className}`}
      aria-label="More from Tolley.io"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
            More from Tolley.io
          </span>
          <Link
            href="/start"
            className="text-xs font-semibold text-neutral-400 transition hover:text-white"
          >
            See all services &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {picks.map((svc) => (
            <Link
              key={svc.name}
              href={svc.url}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 transition hover:-translate-y-0.5 hover:border-white/25"
            >
              <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15">
                {svc.image ? (
                  <Image src={svc.image} alt={svc.title} fill className="object-cover" sizes="40px" />
                ) : (
                  <span className="text-lg" aria-hidden="true">{svc.emoji}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{svc.title}</p>
                <p className="truncate text-xs text-neutral-400">{svc.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
