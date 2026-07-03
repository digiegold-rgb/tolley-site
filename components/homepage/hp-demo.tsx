export function HpDemo() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
      <div className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-10">
        <div className="mb-8 text-center">
          <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
            The Portal
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[0.02em] text-white/95 sm:text-3xl">
            Intelligence at a glance
          </h2>
        </div>

        {/* Mock dashboard */}
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/28">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="ml-3 font-mono text-[0.65rem] tracking-wider text-white/40">
              t-agent — lead dossier
            </span>
          </div>

          {/* Content area */}
          <div className="grid gap-4 p-5 md:grid-cols-3">
            {/* Lead card */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400/30 to-purple-400/30" />
                <div>
                  <p className="text-sm font-semibold text-white/90">Sarah Martinez</p>
                  <p className="text-[0.65rem] tracking-wider text-white/50">Kansas City, MO</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.6rem] font-medium text-emerald-300/90">
                  High Motivation
                </span>
                <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-[0.6rem] font-medium text-violet-300/90">
                  Owner 12yr
                </span>
              </div>
            </div>

            {/* Score gauge */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-[0.65rem] tracking-[0.14em] text-white/50 uppercase">
                Motivation Score
              </p>
              <p className="mt-2 text-5xl font-bold text-violet-200/90">87</p>
              <p className="mt-1 text-[0.62rem] text-white/45">out of 100</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-violet-400 to-purple-300" />
              </div>
            </div>

            {/* Signals */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[0.65rem] tracking-[0.14em] text-white/50 uppercase">
                Key Signals
              </p>
              <ul className="mt-3 space-y-2 text-xs text-white/72">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                  Pre-foreclosure notice filed
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                  Tax lien — $4,200 outstanding
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400/80" />
                  Divorce proceeding — Jackson Co.
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80" />
                  Property vacant 90+ days
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
