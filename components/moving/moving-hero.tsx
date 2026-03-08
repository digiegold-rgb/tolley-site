import { MV_CONTACT_PHONE, MV_FACEBOOK_URL } from "@/lib/moving";

export function MovingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-neutral-950 via-[#0a1a14] to-neutral-950 pb-16 sm:pb-20">
      {/* Decorative glows */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-emerald-500/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-emerald-400/[0.05] blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-emerald-400/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="mv-neon-text mt-5 text-5xl font-black tracking-tight text-emerald-400 uppercase sm:text-6xl lg:text-7xl">
          Skip the
          <br />
          <span className="text-white">Cardboard.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-neutral-300">
          Save hundreds on moving supplies. Get <span className="font-bold text-white">20 heavy-duty totes</span>,{" "}
          <span className="font-bold text-white">25 thick moving blankets</span>, and{" "}
          <span className="font-bold text-white">17 giant rubber bands</span> — all in one bundle.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-neutral-400 uppercase">
          <span className="rounded border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1.5 text-emerald-300">
            Reusable
          </span>
          <span className="rounded border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1.5 text-emerald-300">
            No Tape Mess
          </span>
          <span className="rounded border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1.5 text-emerald-300">
            All Payments Accepted
          </span>
          <span className="rounded border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1.5 text-emerald-300">
            Kansas City
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={`tel:${MV_CONTACT_PHONE}`}
            className="mv-cta-glow inline-flex items-center gap-3 rounded-lg bg-emerald-500 px-8 py-3.5 text-lg font-black tracking-wide text-black uppercase transition-all hover:-translate-y-0.5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call to Book
          </a>
          <a
            href={MV_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-6 py-3.5 text-sm font-bold tracking-wide text-neutral-300 uppercase transition-all hover:border-emerald-500/40 hover:text-white"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            View on Facebook
          </a>
        </div>
      </div>

      {/* Bottom edge */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="block h-[40px] w-full sm:h-[60px]" fill="#0a0a0a">
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(16,185,129,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
