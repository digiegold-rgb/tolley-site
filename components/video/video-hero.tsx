export function VideoHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0d0618] via-[#12082a] to-[#08060f] pb-16 sm:pb-20">
      {/* Decorative glows */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/[0.08] blur-[120px]" />
        <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-violet-400/[0.06] blur-[100px]" />
        <div className="absolute top-1/3 right-[15%] h-60 w-60 rounded-full bg-fuchsia-500/[0.05] blur-[80px]" />

        {/* Film frame decorations */}
        <div className="vid-frame-float absolute top-20 left-[8%] h-24 w-16 rounded border border-purple-400/20 opacity-15">
          <div className="absolute top-1 left-1 right-1 h-1 rounded-full bg-purple-400/30" />
          <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full bg-purple-400/30" />
        </div>
        <div className="vid-frame-float absolute top-40 right-[12%] h-20 w-14 rounded border border-violet-400/15 opacity-10">
          <div className="absolute top-1 left-1 right-1 h-1 rounded-full bg-violet-400/20" />
          <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full bg-violet-400/20" />
        </div>
        <div className="vid-frame-float absolute bottom-32 left-[20%] h-16 w-12 rounded border border-fuchsia-400/15 opacity-10">
          <div className="absolute top-1 left-1 right-1 h-0.5 rounded-full bg-fuchsia-400/20" />
          <div className="absolute bottom-1 left-1 right-1 h-0.5 rounded-full bg-fuchsia-400/20" />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-sm font-bold tracking-[0.4em] text-purple-400/80 uppercase">
          Video Studio
        </p>

        <h1 className="vid-neon-text mt-5 text-5xl font-black tracking-tight text-purple-300 uppercase sm:text-6xl lg:text-7xl">
          AI Video
          <br />
          <span className="text-white">Generator.</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed font-light text-slate-300">
          Cloud-powered AI video for{" "}
          <span className="font-bold text-white">real estate agents</span> &middot; Wan 2.6 &middot;{" "}
          <span className="font-bold text-white">Google Veo 3</span> &middot; Sub-minute delivery.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold tracking-widest text-slate-400 uppercase">
          <span className="pulse-ring rounded border border-purple-400/25 bg-purple-400/[0.08] px-3 py-1.5 text-purple-300" style={{ "--pulse-color": "rgba(168, 85, 247, 0.35)" } as React.CSSProperties}>
            Cloud GPU
          </span>
          <span className="rounded border border-purple-400/25 bg-purple-400/[0.08] px-3 py-1.5 text-purple-300">
            720p-1080p
          </span>
          <span className="rounded border border-purple-400/25 bg-purple-400/[0.08] px-3 py-1.5 text-purple-300">
            AI Audio
          </span>
          <span className="rounded border border-purple-400/25 bg-purple-400/[0.08] px-3 py-1.5 text-purple-300">
            Pay Per Video
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="#generate"
            className="vid-cta-glow inline-flex items-center gap-3 rounded-lg bg-purple-500 px-8 py-3.5 text-lg font-black tracking-wide text-white uppercase transition-all hover:-translate-y-0.5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Generate Video
          </a>
          <a
            href="#models"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-6 py-3.5 text-sm font-bold tracking-wide text-slate-300 uppercase transition-all hover:border-purple-400/40 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            View Models
          </a>
        </div>
      </div>

      {/* Bottom edge */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="block h-[40px] w-full sm:h-[60px]"
          fill="#08060f"
        >
          <polygon points="0,60 1440,60 1440,0 0,60" />
          <line x1="0" y1="60" x2="1440" y2="0" stroke="rgba(168,85,247,0.2)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
