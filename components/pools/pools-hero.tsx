import { POOLS_COMPANY, POOLS_CONTACT_PHONE } from "@/lib/pools";

function WavyText({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="pools-wave-char"
          style={{ "--d": `${i * 0.07}s` } as React.CSSProperties}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </>
  );
}

const tags = [
  "Beat Walmart Prices",
  "KC Metro Delivery",
  "No Membership Required",
];

export function PoolsHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#ecfeff] via-sky-50 to-[#cffafe] pb-20 sm:pb-24">
      {/* Decorative water ripple background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-cyan-300/15" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-sky-300/12" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-cyan-200/20" />
        <div className="absolute bottom-1/4 left-1/3 h-28 w-28 rounded-full bg-cyan-300/25" />
        {/* Spinning ring decoration */}
        <div className="pools-spin-slow absolute top-16 right-[15%] h-48 w-48 rounded-full border-2 border-dashed border-cyan-400/25" />
        {/* Ripple circles */}
        <div className="pools-ripple absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/8" />
        <div
          className="pools-ripple absolute top-1/3 left-1/4 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/6"
          style={{ animationDelay: "1.2s" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-16">
        <p className="text-sm font-extrabold tracking-[0.3em] text-cyan-700 uppercase">
          {POOLS_COMPANY}
        </p>

        <h1 className="mt-4 font-extrabold text-sky-900 text-4xl leading-[1.05] sm:text-5xl lg:text-[4rem]">
          <WavyText text="Pool Supplies." />
          <br />
          <WavyText text="Delivered." />
        </h1>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-sky-700/80 sm:text-lg">
          Same-week delivery across Kansas City metro. Chemicals, equipment, and
          everything in between.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold tracking-wider text-cyan-800 backdrop-blur-sm ring-1 ring-cyan-200/60"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#products"
            className="pools-glow inline-flex items-center rounded-full bg-cyan-500 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-cyan-600 hover:shadow-xl"
          >
            Shop Now
          </a>
          <span className="inline-flex items-center rounded-full border-2 border-cyan-300/40 bg-white/40 px-8 py-3 text-sm font-bold text-cyan-800 backdrop-blur-sm">
            Free delivery over $75
          </span>
          <a
            href={`tel:${POOLS_CONTACT_PHONE}`}
            className="inline-flex items-center rounded-full border-2 border-cyan-300/40 px-6 py-3 text-sm font-bold text-cyan-800 transition-all hover:bg-white/60"
          >
            Call to Order
          </a>
        </div>
      </div>

      {/* Wave transition */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="block h-[60px] w-full sm:h-[80px]"
          fill="#f0fdfa"
        >
          <path d="M0,40 Q180,70 360,40 Q540,10 720,40 Q900,70 1080,40 Q1260,10 1440,40 L1440,100 L0,100 Z" />
          <circle cx="120" cy="38" r="8" fill="#f0fdfa" opacity="0.6" />
          <circle cx="360" cy="32" r="6" fill="#f0fdfa" opacity="0.5" />
          <circle cx="700" cy="36" r="10" fill="#f0fdfa" opacity="0.6" />
          <circle cx="1000" cy="30" r="7" fill="#f0fdfa" opacity="0.5" />
          <circle cx="1300" cy="38" r="9" fill="#f0fdfa" opacity="0.6" />
        </svg>
      </div>
    </section>
  );
}
