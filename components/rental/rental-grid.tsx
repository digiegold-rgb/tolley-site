import Link from "next/link";
import Image from "next/image";

import { RENTAL_ITEMS } from "@/lib/rental";

export function RentalGrid() {
  return (
    <section>
      <h2 className="rent-neon-text text-2xl font-black tracking-wide text-teal-400 uppercase sm:text-3xl">
        Our Rentals
      </h2>
      <p className="mt-2 text-sm font-light text-slate-400">
        Click any item to see full details, pricing, and photos.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {RENTAL_ITEMS.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            className="rent-card group overflow-hidden rounded-xl border border-slate-700/50 bg-[#13131a] transition-all hover:border-opacity-80"
            style={{
              "--card-glow": `${item.accentColor}33`,
              borderColor: `${item.accentColor}20`,
            } as React.CSSProperties}
          >
            {/* Image */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/30">
              <Image
                src={item.image}
                alt={item.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </div>

            {/* Content */}
            <div className="p-5">
              <h3 className="text-lg font-black tracking-wide text-white uppercase">
                {item.name}
              </h3>
              <p className="mt-1 text-sm font-light leading-relaxed text-slate-400">
                {item.tagline}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className="text-sm font-bold"
                  style={{ color: item.accentColor }}
                >
                  {item.startingPrice}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-bold uppercase transition-colors"
                  style={{
                    backgroundColor: `${item.accentColor}15`,
                    color: item.accentColor,
                  }}
                >
                  View Details
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
