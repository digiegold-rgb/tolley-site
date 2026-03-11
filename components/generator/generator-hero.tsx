import { GEN_CONTACT_PHONE, GEN_FACEBOOK_URL, GEN_STRIPE_CHECKOUT_URL } from "@/lib/generator";

export function GeneratorHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0a0e27] via-[#0d1233] to-[#0a0e27] pb-16 sm:pb-20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Electric yellow accent glows */}
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-yellow-400/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-yellow-300/[0.05] blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-[60px]" />

        {/* Lightning bolt SVG sparks */}
        <svg className="gen-spark absolute top-16 right-[15%] h-20 w-8 text-yellow-400/60" viewBox="0 0 32 80" fill="currentColor">
          <polygon points="18,0 8,32 16,32 6,80 28,28 18,28 26,0" />
        </svg>
        <svg className="gen-spark absolute top-32 left-[10%] h-16 w-6 text-yellow-300/50" viewBox="0 0 32 80" fill="currentColor">
          <polygon points="18,0 8,32 16,32 6,80 28,28 18,28 26,0" />
        </svg>
        <svg className="gen-spark absolute bottom-24 right-[25%] h-12 w-5 text-yellow-400/40" viewBox="0 0 32 80" fill="currentColor">
          <polygon points="18,0 8,32 16,32 6,80 28,28 18,28 26,0" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-yellow-400/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="gen-neon-text mt-5 text-5xl font-black tracking-tight text-yellow-400 uppercase sm:text-6xl lg:text-7xl">
          Power Anything.
          <br />
          <span className="text-white">Anywhere.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-slate-300">
          The <span className="font-bold text-white">FIRMAN T07571</span> tri-fuel
          generator — 9,400 starting watts, 7,500 running watts. Parties,
          emergencies, job sites, and everything in between.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
          <span className="pulse-ring rounded border border-yellow-400/25 bg-yellow-400/[0.08] px-3 py-1.5 text-yellow-300" style={{ "--pulse-color": "rgba(250, 204, 21, 0.35)" } as React.CSSProperties}>
            Tri-Fuel
          </span>
          <span className="rounded border border-yellow-400/25 bg-yellow-400/[0.08] px-3 py-1.5 text-yellow-300">
            Party Ready
          </span>
          <span className="rounded border border-yellow-400/25 bg-yellow-400/[0.08] px-3 py-1.5 text-yellow-300">
            Free Delivery &amp; Pickup
          </span>
          <span className="rounded border border-yellow-400/25 bg-yellow-400/[0.08] px-3 py-1.5 text-yellow-300">
            Kansas City
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={GEN_STRIPE_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="gen-cta-glow inline-flex items-center gap-3 rounded-lg bg-yellow-400 px-8 py-3.5 text-lg font-black tracking-wide text-[#0a0e27] uppercase transition-all hover:-translate-y-0.5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Rent Now
          </a>
          <a
            href={`tel:${GEN_CONTACT_PHONE}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-6 py-3.5 text-sm font-bold tracking-wide text-slate-300 uppercase transition-all hover:border-yellow-400/40 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call to Reserve
          </a>
          <a
            href={GEN_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-6 py-3.5 text-sm font-bold tracking-wide text-slate-300 uppercase transition-all hover:border-yellow-400/40 hover:text-white"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            View on Facebook
          </a>
        </div>
      </div>

      {/* Bottom edge — angular cut */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="block h-[40px] w-full sm:h-[60px]"
          fill="#0a0e27"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(255,208,0,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
