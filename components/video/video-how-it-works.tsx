import { VIDEO_PROCESS_STEPS } from "@/lib/video";

export function VideoHowItWorks() {
  return (
    <section id="how-it-works">
      <h2 className="text-center text-3xl font-black tracking-tight text-white uppercase sm:text-4xl">
        How It Works
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-base text-slate-400">
        Three steps. No editing software. No stock footage. Just your words and our AI.
      </p>

      <div className="relative mt-10 grid gap-8 sm:grid-cols-3">
        {VIDEO_PROCESS_STEPS.map((step, i) => (
          <div key={step.step} className="vid-card relative rounded-xl border border-purple-400/15 bg-purple-400/[0.04] p-6 text-center">
            {/* Step number */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-400/30 bg-purple-500/10 text-2xl font-black text-purple-300">
              {step.step}
            </div>

            {/* Connector line (not on last) */}
            {i < VIDEO_PROCESS_STEPS.length - 1 && (
              <div className="absolute top-11 -right-4 hidden h-0.5 w-8 bg-gradient-to-r from-purple-400/30 to-transparent sm:block" aria-hidden="true" />
            )}

            <h3 className="mt-4 text-lg font-bold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
