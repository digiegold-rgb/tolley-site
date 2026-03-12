import { VATER_VENTURES } from "@/lib/vater";

const venture = VATER_VENTURES.find((v) => v.slug === "dropship")!;

export function DropshipHero() {
  return (
    <section className="relative py-24 text-center">
      {/* Glow effects */}
      <div className="vater-hero-glow vater-hero-glow-left" />
      <div className="vater-hero-glow vater-hero-glow-right" />

      <div className="relative z-10 mx-auto max-w-4xl px-6">
        {/* Badges */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          {venture.badges.map((badge) => (
            <span key={badge} className="vater-badge">
              {badge}
            </span>
          ))}
        </div>

        {/* Heading */}
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          <span className="vater-neon">Amazon</span> to{" "}
          <span className="vater-neon">eBay</span>{" "}
          <span className="vater-neon-amber">Arbitrage</span>,{" "}
          <span className="text-white">Automated</span>
        </h1>

        {/* Subtitle */}
        <p className="vater-section-subtitle mx-auto text-lg">
          Zero inventory dropshipping powered by AI. Scan price gaps, auto-list
          at markup, fulfill direct from Amazon. You keep the spread — the bot
          does the work.
        </p>

        {/* Icon */}
        <div className="mt-10 text-6xl" aria-hidden="true">
          {venture.icon}
        </div>
      </div>
    </section>
  );
}
