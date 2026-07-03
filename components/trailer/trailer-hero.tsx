import { TR_CONTACT_PHONE, TR_FACEBOOK_URL } from "@/lib/trailer";

export function TrailerHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 pb-16 sm:pb-20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Amber accent glow */}
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-amber-500/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-orange-500/[0.05] blur-[80px]" />
        {/* Hazard stripe accent */}
        <div className="trailer-hazard absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-amber-400/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="trailer-neon-text mt-5 text-5xl font-black tracking-tight text-amber-400 uppercase sm:text-6xl lg:text-7xl">
          Rent a Trailer.
          <br />
          <span className="text-white">Get It Done.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-neutral-300">
          Heavy-duty utility trailers ready when you are. No plates needed, no
          hassle. Independence, MO.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-neutral-400 uppercase">
          <span className="rounded border border-amber-500/25 bg-amber-500/[0.08] px-3 py-1.5 text-amber-300">
            Cash Box Available
          </span>
          <span className="rounded border border-amber-500/25 bg-amber-500/[0.08] px-3 py-1.5 text-amber-300">
            Driver&apos;s License Required
          </span>
          <span className="rounded border border-amber-500/25 bg-amber-500/[0.08] px-3 py-1.5 text-amber-300">
            Your Insurance Covers It
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={TR_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="trailer-glow inline-flex items-center gap-3 rounded-lg bg-amber-500 px-8 py-3.5 text-lg font-black tracking-wide text-black uppercase transition-all hover:-translate-y-0.5"
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
          fill="#0c0c0c"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(245,158,11,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
