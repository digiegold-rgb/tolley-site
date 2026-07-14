import Link from "next/link";

/**
 * "Can't make the sale? Keep shopping with us." — a conversion block for the
 * estate-sale traffic spike. Estate shoppers who can't attend are warm leads
 * for everything else Tolley does: buying our finds online, hiring Jared to
 * sell their own home, or a full estate cleanout. On-brand (es-* tokens),
 * used on /estate and each sale page. `ref` tags the click for /hq routing.
 */

interface KeepShoppingLink {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  cta: string;
}

const LINKS: KeepShoppingLink[] = [
  {
    href: "/shop?ref=estate",
    emoji: "🛍️",
    title: "Ruthann's Treasure Haul",
    desc: "Can't make it in person? Shop our vintage & reseller finds online — buy now, we ship. 215+ sold, plus our favorite Amazon picks.",
    cta: "Shop the finds",
  },
  {
    href: "/homes?ref=estate",
    emoji: "🏡",
    title: "Thinking of selling a home?",
    desc: "Behind every estate sale is a house. Jared is a licensed Kansas City agent (Your KC Homes) — from a full estate to a family move, get a straight answer on what it's worth.",
    cta: "Talk to Jared about your home",
  },
  {
    href: "/cleanouts?ref=estate",
    emoji: "📦",
    title: "Whole-house cleanout",
    desc: "Clearing an estate or a property? We empty it top to bottom — anything with resale value lowers your bill, and you get it broom-clean.",
    cta: "Get a cleanout quote",
  },
  {
    href: "/food?ref=estate",
    emoji: "🍽️",
    title: "Ruthann's Kitchen",
    desc: "Love the vintage kitchenware? Ruthann's recipes and meal plans are the same warm, no-nonsense KC style.",
    cta: "Visit the kitchen",
  },
];

export default function KeepShopping({ heading }: { heading?: string }) {
  return (
    <section className="es-panel p-7 sm:p-9" aria-label="More from Tolley">
      <div className="text-center">
        <p className="es-kicker justify-center">Can&apos;t make it in person?</p>
        <h2 className="es-display mt-3 text-2xl sm:text-3xl">
          {heading ?? "There's more where this came from"}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm" style={{ color: "var(--es-cream-dim)" }}>
          The sale is just one corner of what our family runs here in Kansas City.
          If you can&apos;t make it Friday or Saturday, there&apos;s still plenty for you.
        </p>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="es-card group flex flex-col p-6 transition"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                {l.emoji}
              </span>
              <div className="min-w-0">
                <h3
                  className="es-display text-lg"
                  style={{ color: "var(--es-brass-bright)" }}
                >
                  {l.title}
                </h3>
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{ color: "var(--es-cream-dim)" }}
                >
                  {l.desc}
                </p>
              </div>
            </div>
            <span
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold transition-transform group-hover:translate-x-0.5"
              style={{ color: "var(--es-brass)" }}
            >
              {l.cta} <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs" style={{ color: "var(--es-cream-dim)" }}>
        And don&apos;t leave without joining the early list below — you&apos;ll get the next
        sale&apos;s address before anyone else.
      </p>
    </section>
  );
}
