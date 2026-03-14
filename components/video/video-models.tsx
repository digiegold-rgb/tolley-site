import { VIDEO_TIERS } from "@/lib/video";

export function VideoModels() {
  return (
    <section id="models">
      <h2 className="text-center text-3xl font-black tracking-tight text-white uppercase sm:text-4xl">
        Four Tiers. Pick Your Level.
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-base text-slate-400">
        From quick social clips to full cinematic productions with AI-generated audio.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {VIDEO_TIERS.map((tier) => (
          <div key={tier.id} className="vid-card rounded-xl border border-purple-400/15 bg-purple-400/[0.04] p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-white">{tier.name}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {tier.resolution} &middot; {tier.duration}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="vid-badge-shimmer rounded-full border border-purple-400/30 bg-purple-500/15 px-3 py-1 text-xs font-bold tracking-wider text-purple-300 uppercase">
                  {tier.badge}
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">{tier.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {tier.strengths.map((s) => (
                <span key={s} className="rounded border border-purple-400/20 bg-purple-400/[0.06] px-2.5 py-1 text-xs font-bold text-purple-300/80">
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <svg className="h-3.5 w-3.5 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {tier.estimatedTime}
              </div>
              <div className="flex items-center gap-3">
                {tier.hasAudio && (
                  <span className="rounded border border-green-400/20 bg-green-400/[0.06] px-2 py-0.5 text-[10px] font-bold text-green-300">
                    + AUDIO
                  </span>
                )}
                <span className="text-sm font-bold text-purple-300">
                  {tier.credits} credit{tier.credits > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-700/50 pt-3 text-xs text-slate-600">
              Powered by {tier.modelLabel} &middot; Cloud GPU
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
