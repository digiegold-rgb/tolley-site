import { VATER_VENTURES } from "@/lib/vater";

const youtube = VATER_VENTURES.find((v) => v.slug === "youtube")!;

export function YouTubeHero() {
  return (
    <section className="relative flex flex-col items-center px-6 pb-16 pt-24 text-center">
      {/* Ambient glow */}
      <div className="vater-hero-glow vater-hero-glow-left" aria-hidden="true" />
      <div className="vater-hero-glow vater-hero-glow-right" aria-hidden="true" />

      <span className="relative z-10 mb-4 text-4xl">{youtube.icon}</span>

      <h1 className="vater-neon relative z-10 text-4xl font-bold tracking-wide sm:text-5xl lg:text-6xl">
        Faceless Content Machine
      </h1>

      <div className="relative z-10 mt-6 flex flex-wrap justify-center gap-2">
        {youtube.badges.map((badge) => (
          <span key={badge} className="vater-badge">
            {badge}
          </span>
        ))}
      </div>

      <p className="relative z-10 mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl">
        AI-powered faceless YouTube pipeline — from trending topic to published
        video, fully automated. Source, script, voice, edit, publish at scale.
      </p>
    </section>
  );
}
