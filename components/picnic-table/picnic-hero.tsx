import { PT_FACEBOOK_URL } from "@/lib/picnic-table";

export function PicnicHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0b1a0f] via-[#0e1f12] to-[#0b1a0f] pb-16 sm:pb-20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-[#c4a56e]/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-[#c4a56e]/[0.05] blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/[0.04] blur-[60px]" />

        {/* Leaf silhouettes */}
        <svg className="absolute top-20 right-[12%] h-24 w-16 text-green-400/10" viewBox="0 0 64 96" fill="currentColor">
          <ellipse cx="32" cy="40" rx="24" ry="36" />
          <line x1="32" y1="4" x2="32" y2="96" stroke="currentColor" strokeWidth="2" />
        </svg>
        <svg className="absolute bottom-28 left-[8%] h-16 w-12 text-green-400/8" viewBox="0 0 64 96" fill="currentColor">
          <ellipse cx="32" cy="40" rx="24" ry="36" />
          <line x1="32" y1="4" x2="32" y2="96" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-[#c4a56e]/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="pt-neon-text mt-5 text-5xl font-black tracking-tight text-[#c4a56e] uppercase sm:text-6xl lg:text-7xl">
          Picnic Table.
          <br />
          <span className="text-white">Take It Outside.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-slate-300">
          A sturdy folding picnic table for cookouts, birthday parties, tailgates,
          and any outdoor gathering. Easy to set up and break down.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
          <span className="rounded border border-[#c4a56e]/25 bg-[#c4a56e]/[0.08] px-3 py-1.5 text-[#d4b87a]">
            $28/Day
          </span>
          <span className="rounded border border-[#c4a56e]/25 bg-[#c4a56e]/[0.08] px-3 py-1.5 text-[#d4b87a]">
            $30 Deposit
          </span>
          <span className="rounded border border-[#c4a56e]/25 bg-[#c4a56e]/[0.08] px-3 py-1.5 text-[#d4b87a]">
            Delivery Available
          </span>
          <span className="rounded border border-[#c4a56e]/25 bg-[#c4a56e]/[0.08] px-3 py-1.5 text-[#d4b87a]">
            Kansas City
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={PT_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pt-cta-glow inline-flex items-center gap-3 rounded-lg bg-[#c4a56e] px-8 py-3.5 text-lg font-black tracking-wide text-[#0b1a0f] uppercase transition-all hover:-translate-y-0.5"
          >
            Message on Facebook
          </a>
        </div>
      </div>

      {/* Bottom edge — angular cut */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="block h-[40px] w-full sm:h-[60px]"
          fill="#0b1a0f"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(196,165,110,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
