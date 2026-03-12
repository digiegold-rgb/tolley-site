import { VATER_TAGLINE, VATER_DESCRIPTION } from "@/lib/vater";

export function VaterHubHero() {
  return (
    <section className="relative flex flex-col items-center px-6 pb-16 pt-24 text-center">
      {/* Ambient glow */}
      <div className="vater-hero-glow vater-hero-glow-left" aria-hidden="true" />
      <div className="vater-hero-glow vater-hero-glow-right" aria-hidden="true" />

      <h1 className="vater-neon relative z-10 text-4xl font-bold tracking-wide sm:text-5xl lg:text-6xl">
        {VATER_TAGLINE}
      </h1>

      <p className="relative z-10 mt-5 max-w-2xl text-lg text-slate-400 sm:text-xl">
        {VATER_DESCRIPTION}
      </p>
    </section>
  );
}
