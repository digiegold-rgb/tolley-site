import { KP_FACEBOOK_URL } from "@/lib/kerplunk";

export function KerplunkHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#12081e] via-[#1a0c2a] to-[#12081e] pb-16 sm:pb-20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-[#e040a0]/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-purple-500/[0.06] blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e040a0]/[0.04] blur-[60px]" />

        {/* Confetti circles */}
        <div className="absolute top-16 right-[15%] h-6 w-6 rounded-full bg-[#e040a0]/20" />
        <div className="absolute top-28 left-[10%] h-4 w-4 rounded-full bg-purple-400/15" />
        <div className="absolute bottom-32 right-[25%] h-5 w-5 rounded-full bg-cyan-400/15" />
        <div className="absolute top-40 right-[35%] h-3 w-3 rounded-full bg-[#e040a0]/15" />
        <div className="absolute bottom-20 left-[20%] h-4 w-4 rounded-full bg-purple-400/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-[#e040a0]/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="kp-neon-text mt-5 text-5xl font-black tracking-tight text-[#e040a0] uppercase sm:text-6xl lg:text-7xl">
          Giant Kerplunk.
          <br />
          <span className="text-white">Game On.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-slate-300">
          The life-sized version of the classic game — pull the sticks without
          dropping the balls. A hit at birthday parties, cookouts, family reunions,
          and any outdoor event.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
          <span className="rounded border border-[#e040a0]/25 bg-[#e040a0]/[0.08] px-3 py-1.5 text-[#f06cc0]">
            $18/Day
          </span>
          <span className="rounded border border-[#e040a0]/25 bg-[#e040a0]/[0.08] px-3 py-1.5 text-[#f06cc0]">
            Party Favorite
          </span>
          <span className="rounded border border-[#e040a0]/25 bg-[#e040a0]/[0.08] px-3 py-1.5 text-[#f06cc0]">
            $30 Deposit
          </span>
          <span className="rounded border border-[#e040a0]/25 bg-[#e040a0]/[0.08] px-3 py-1.5 text-[#f06cc0]">
            Kansas City
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={KP_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="kp-cta-glow inline-flex items-center gap-3 rounded-lg bg-[#e040a0] px-8 py-3.5 text-lg font-black tracking-wide text-white uppercase transition-all hover:-translate-y-0.5"
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
          fill="#12081e"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(224,64,160,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
