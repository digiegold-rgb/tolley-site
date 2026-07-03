import { TBL_FACEBOOK_URLS } from "@/lib/tables";

export function TablesHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1a12] via-[#0d1f16] to-[#0a1a12] pb-16 sm:pb-20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-[#c8a84e]/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-[#c8a84e]/[0.05] blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.04] blur-[60px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-[#c8a84e]/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="tbl-neon-text mt-5 text-5xl font-black tracking-tight text-[#c8a84e] uppercase sm:text-6xl lg:text-7xl">
          Tables &amp; Chairs.
          <br />
          <span className="text-white">For Any Event.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-slate-300">
          Round tables, 6ft, 8ft, and adjustable 4ft tables — plus folding chairs.
          Perfect for parties, cookouts, garage sales, and gatherings of any size.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
          <span className="rounded border border-[#c8a84e]/25 bg-[#c8a84e]/[0.08] px-3 py-1.5 text-[#dbc278]">
            $5/Day Per Item
          </span>
          <span className="rounded border border-[#c8a84e]/25 bg-[#c8a84e]/[0.08] px-3 py-1.5 text-[#dbc278]">
            $30 Deposit
          </span>
          <span className="rounded border border-[#c8a84e]/25 bg-[#c8a84e]/[0.08] px-3 py-1.5 text-[#dbc278]">
            Delivery Available
          </span>
          <span className="rounded border border-[#c8a84e]/25 bg-[#c8a84e]/[0.08] px-3 py-1.5 text-[#dbc278]">
            Kansas City
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={TBL_FACEBOOK_URLS[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="tbl-cta-glow inline-flex items-center gap-3 rounded-lg bg-[#c8a84e] px-8 py-3.5 text-lg font-black tracking-wide text-[#0a1a12] uppercase transition-all hover:-translate-y-0.5"
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
          fill="#0a1a12"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(200,168,78,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
