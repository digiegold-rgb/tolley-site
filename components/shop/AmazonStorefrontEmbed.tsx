/**
 * Embed-style strip for the Amazon Influencer storefront.
 *
 * Amazon doesn't ship a true `<iframe>`-able vanity storefront — `amazon.com/shop/<slug>`
 * sets X-Frame-Options: SAMEORIGIN, which kills any iframe attempt. So instead
 * we render a "preview tile" that links out, with a placeholder grid you can
 * later replace with curated picks once we sync Idea Lists (Tier 1).
 *
 * Configure via AMAZON_STOREFRONT_URL env var; defaults to the production
 * vanity so this works out of the box.
 */

const STOREFRONT_URL =
  process.env.AMAZON_STOREFRONT_URL || "https://www.amazon.com/shop/digitaljared";
const STOREFRONT_NAME =
  process.env.AMAZON_STOREFRONT_NAME || "digitaljared";

interface PreviewItem {
  asin: string;
  title: string;
  imageUrl: string | null;
}

export default function AmazonStorefrontEmbed({
  highlights = [],
}: {
  highlights?: PreviewItem[];
}) {
  return (
    <section
      aria-label="Amazon storefront"
      className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/85">
            🛒 Amazon Storefront
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">
            Shop Jared&rsquo;s Amazon picks
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Curated Idea Lists, shoppable videos &amp; live launches at{" "}
            <code className="text-white/75">amazon.com/shop/{STOREFRONT_NAME}</code>
          </p>
        </div>
        <a
          href={STOREFRONT_URL}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="rounded-full bg-[#FF9900] px-5 py-2 text-sm font-bold text-black hover:bg-[#ffb13a]"
        >
          Open on Amazon →
        </a>
      </div>

      {highlights.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {highlights.slice(0, 6).map((h) => (
            <a
              key={h.asin}
              href={`https://www.amazon.com/dp/${h.asin}?tag=tolley-shop-20`}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="group block rounded-lg border border-white/5 bg-black/30 p-2 transition hover:border-amber-300/40"
              title={h.title}
            >
              {h.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={h.imageUrl}
                  alt={h.title}
                  className="aspect-square w-full rounded-md object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-square rounded-md bg-white/5" />
              )}
              <p className="mt-2 line-clamp-2 text-[0.65rem] text-white/65 group-hover:text-white/85">
                {h.title}
              </p>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-amber-300/20 bg-black/20 p-6 text-center text-sm text-white/55">
          Top picks load here once Idea Lists sync (Tier 1, unlocks after
          probation). For now,{" "}
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="text-amber-300 underline hover:text-amber-200"
          >
            browse the full storefront
          </a>
          .
        </div>
      )}

      <p className="mt-3 text-[0.7rem] text-white/35">
        As an Amazon Associate I earn from qualifying purchases.
      </p>
    </section>
  );
}
