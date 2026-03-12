export function GovBidsHero() {
  return (
    <section className="relative flex flex-col items-center px-6 pb-16 pt-24 text-center">
      {/* Ambient glow */}
      <div className="vater-hero-glow vater-hero-glow-left" aria-hidden="true" />
      <div className="vater-hero-glow vater-hero-glow-right" aria-hidden="true" />

      {/* Badges */}
      <div className="relative z-10 mb-6 flex flex-wrap justify-center gap-3">
        <span className="vater-badge">SAM.gov</span>
        <span className="vater-badge">Low Competition</span>
        <span className="vater-badge">High Margin</span>
      </div>

      <h1 className="vater-neon relative z-10 text-4xl font-bold tracking-wide sm:text-5xl lg:text-6xl">
        Government &amp; Military Supply Contracts
      </h1>

      <p className="relative z-10 mt-5 max-w-2xl text-lg text-slate-400 sm:text-xl">
        The U.S. government spends over $700B+ annually on goods and services.
        AI scans solicitations, calculates margins, and generates compliant bids
        so you can win contracts most suppliers ignore.
      </p>
    </section>
  );
}
