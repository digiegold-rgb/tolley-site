import { VATER_VENTURES } from "@/lib/vater";

const merch = VATER_VENTURES.find((v) => v.slug === "merch")!;

export function MerchHero() {
  return (
    <section className="relative flex flex-col items-center px-6 pb-16 pt-24 text-center">
      {/* Ambient glow */}
      <div className="vater-hero-glow vater-hero-glow-left" aria-hidden="true" />
      <div className="vater-hero-glow vater-hero-glow-right" aria-hidden="true" />

      {/* Icon */}
      <span className="relative z-10 mb-4 text-5xl" role="img" aria-label="Merch">
        {merch.icon}
      </span>

      {/* Heading */}
      <h1 className="relative z-10 text-4xl font-bold tracking-wide sm:text-5xl lg:text-6xl">
        <span className="vater-neon">Print-on-Demand</span>{" "}
        <span className="vater-neon-amber">Empire</span>
      </h1>

      {/* Subtitle */}
      <p className="relative z-10 mt-5 max-w-2xl text-lg text-slate-400 sm:text-xl">
        AI-generated designs, auto-listed on Etsy, printed and shipped by Printful.
        Zero inventory. Zero shipping. Pure margin.
      </p>

      {/* Badges */}
      <div className="relative z-10 mt-8 flex flex-wrap justify-center gap-3">
        {merch.badges.map((badge) => (
          <span key={badge} className="vater-badge">
            {badge}
          </span>
        ))}
      </div>
    </section>
  );
}
