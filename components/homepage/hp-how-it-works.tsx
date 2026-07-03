const steps = [
  {
    number: "01",
    title: "Import Your Leads",
    description:
      "Upload a list, connect your MLS feed, or manually enter contacts. T-Agent ingests from any source.",
  },
  {
    number: "02",
    title: "AI Enriches Everything",
    description:
      "Court records, social profiles, property history, and public data are pulled and scored automatically.",
  },
  {
    number: "03",
    title: "Act on Intelligence",
    description:
      "Get ranked dossiers with motivation scores. Launch SMS sequences. Close deals with confidence.",
  },
];

export function HpHowItWorks() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
      <div className="mb-10 text-center">
        <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
          How It Works
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[0.02em] text-white/95 sm:text-4xl">
          Three steps to smarter prospecting
        </h2>
      </div>

      <div className="relative grid gap-6 md:grid-cols-3">
        {/* Connecting line (desktop) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-12 right-[17%] left-[17%] hidden h-px md:block"
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
        </div>

        {steps.map((step, i) => (
          <div
            key={step.number}
            className="group relative rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(129,75,229,0.09)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/28"
          >
            {/* Step number with glow */}
            <div className="relative mb-3 inline-block">
              <span className="text-4xl font-bold tracking-tight text-violet-300/20 transition-colors group-hover:text-violet-300/35">
                {step.number}
              </span>
              {/* Dot indicator */}
              <span
                className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full border border-violet-300/40 bg-violet-400/30"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            </div>
            <h3 className="text-lg font-semibold text-white/95">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/68">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
