import { HM_URE_URL, HM_CONTACT_PHONE, HM_SERVICE_AREAS } from "@/lib/homes";

export function HomesHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-neutral-950 via-slate-900 to-neutral-950 pb-16 sm:pb-20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-sky-500/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-blue-500/[0.05] blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-sky-400/80 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="homes-neon-text mt-5 text-5xl font-extrabold tracking-tight text-sky-300 sm:text-6xl lg:text-7xl">
          Find Your Next Home
          <br />
          <span className="text-white">in Kansas City.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-neutral-300">
          Whether you&apos;re <strong className="font-semibold text-white">buying, selling, or investing</strong> —
          get expert guidance from a local agent who knows the KC metro inside and out.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-neutral-400 uppercase">
          {HM_SERVICE_AREAS.slice(0, 4).map((area) => (
            <span
              key={area}
              className="rounded border border-sky-500/25 bg-sky-500/[0.08] px-3 py-1.5 text-sky-300"
            >
              {area}
            </span>
          ))}
          <span className="rounded border border-sky-500/25 bg-sky-500/[0.08] px-3 py-1.5 text-sky-300">
            + {HM_SERVICE_AREAS.length - 4} More
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={HM_URE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="homes-glow inline-flex items-center gap-3 rounded-lg bg-sky-500 px-8 py-3.5 text-lg font-extrabold tracking-wide text-white uppercase transition-all hover:-translate-y-0.5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Search Homes
          </a>
          <a
            href={`tel:${HM_CONTACT_PHONE}`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-6 py-3.5 text-sm font-bold tracking-wide text-neutral-300 uppercase transition-all hover:border-sky-500/40 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Call Jared
          </a>
        </div>
      </div>

      {/* Bottom edge — angular cut */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="block h-[40px] w-full sm:h-[60px]"
          fill="#0a0f1a"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(56,189,248,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
