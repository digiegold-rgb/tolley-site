import { MV_FACEBOOK_URL } from "@/lib/moving";

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
            href={MV_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mv-cta-glow inline-flex items-center gap-3 rounded-lg bg-emerald-500 px-8 py-3.5 text-lg font-black tracking-wide text-black uppercase transition-all hover:-translate-y-0.5"
          >
            Message on Facebook
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
