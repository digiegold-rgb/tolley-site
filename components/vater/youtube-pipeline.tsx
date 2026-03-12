import { YOUTUBE_STEPS } from "@/lib/vater";

export function YouTubePipeline() {
  return (
    <section>
      <h2 className="vater-section-title">Content Pipeline</h2>
      <p className="vater-section-subtitle mt-2">
        Five stages from idea to income — each one automated.
      </p>

      <div className="mt-10 space-y-0">
        {YOUTUBE_STEPS.map((s, i) => (
          <div key={s.step} className="relative flex gap-5">
            {/* Vertical connector line */}
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-content-center rounded-xl border border-sky-400/30 bg-sky-400/10 text-2xl leading-none justify-center">
                {s.icon}
              </div>
              {i < YOUTUBE_STEPS.length - 1 && (
                <div className="w-px flex-1 bg-gradient-to-b from-sky-400/30 to-sky-400/5" />
              )}
            </div>

            {/* Step content */}
            <div className="pb-8">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
                  Step {s.step}
                </span>
                <span className="vater-neon text-lg font-bold">{s.title}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                {s.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
