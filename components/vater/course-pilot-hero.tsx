import { PILOT_COURSE } from "@/lib/vater";

export function CoursePilotHero() {
  return (
    <section className="relative flex flex-col items-center px-6 pb-16 pt-24 text-center">
      {/* Ambient glow */}
      <div className="vater-hero-glow vater-hero-glow-left" aria-hidden="true" />
      <div className="vater-hero-glow vater-hero-glow-right" aria-hidden="true" />

      <span className="relative z-10 mb-4 text-5xl" role="img" aria-label="Airplane">
        {PILOT_COURSE.icon}
      </span>

      <h1 className="vater-neon relative z-10 text-4xl font-bold tracking-wide sm:text-5xl lg:text-6xl">
        {PILOT_COURSE.title}
      </h1>

      <p className="relative z-10 mt-5 max-w-2xl text-lg text-slate-400 sm:text-xl">
        {PILOT_COURSE.subtitle}
      </p>

      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-4">
        <span className="vater-badge vater-neon-amber !border-amber-500/30 !bg-amber-500/10 !text-amber-400 !px-4 !py-1.5 !text-base">
          ${PILOT_COURSE.price} one-time
        </span>
        <span className="vater-badge">
          {PILOT_COURSE.moduleCount} modules
        </span>
      </div>

      <p className="relative z-10 mt-4 text-sm text-slate-500">
        <span className="font-semibold text-slate-400">For:</span>{" "}
        {PILOT_COURSE.audience}
      </p>
    </section>
  );
}
