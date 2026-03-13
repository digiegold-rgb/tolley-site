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
    <section className="relative bg-gradient-to-br from-cyan-600 via-cyan-500 to-sky-400 pb-20 sm:pb-24">
      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-white/[0.07]" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute bottom-1/4 left-1/3 h-28 w-28 rounded-full bg-cyan-300/15" />
        {/* Spinning ring decoration */}
        <div className="pools-spin-slow absolute top-16 right-[15%] h-48 w-48 rounded-full border-2 border-dashed border-white/10" />
        {/* Ripple circle */}
        <div className="pools-ripple absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.06]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-16">
        <p className="text-sm font-semibold tracking-[0.3em] text-cyan-100 uppercase">
          {POOLS_COMPANY}
        </p>

        <h1 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl lg:text-6xl">
          <WavyText text="Pool Supplies," />
          <br />
          <WavyText text="Delivered." />
        </h1>

        <p className="mt-4 max-w-xl text-lg leading-relaxed text-cyan-50">
          Contractor pricing. No retail markup. Straight to your door.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold tracking-wider text-white backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#products"
            className="pools-glow inline-flex items-center rounded-full bg-white px-8 py-3 text-sm font-bold text-cyan-700 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Shop Now
          </a>
          <a
            href={`tel:${POOLS_CONTACT_PHONE}`}
            className="inline-flex items-center rounded-full border-2 border-white/30 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
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
