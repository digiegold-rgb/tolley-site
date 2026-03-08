const useCases = [
  {
    emoji: "\uD83C\uDF89",
    title: "Backyard Parties",
    description:
      "Bounce houses, inflatables, DJ setup, outdoor lighting \u2014 keep the party going all day and night.",
  },
  {
    emoji: "\u26A1",
    title: "Power Outages",
    description:
      "Keep your lights, fridge, and essentials running when the grid goes down. Peace of mind in any storm.",
  },
  {
    emoji: "\uD83C\uDFD7\uFE0F",
    title: "Job Sites",
    description:
      "Power tools, compressors, and heavy equipment on the go. No outlet? No problem.",
  },
  {
    emoji: "\uD83C\uDFD5\uFE0F",
    title: "Outdoor Events",
    description:
      "Weddings, BBQs, tailgates, camping trips \u2014 reliable power wherever the venue is.",
  },
  {
    emoji: "\uD83C\uDF0A",
    title: "Summer Fun",
    description:
      "Slip \u2019n slides, inflatable pools, outdoor movie nights. Make your backyard the best spot on the block.",
  },
  {
    emoji: "\uD83D\uDD27",
    title: "Home Projects",
    description:
      "Renovations, painting, power washing \u2014 tackle big projects without worrying about extension cords.",
  },
];

export function GeneratorUses() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1030] p-6 sm:p-8">
      <h2 className="gen-neon-text text-2xl font-black tracking-wide text-yellow-400 uppercase sm:text-3xl">
        What Will You Power?
      </h2>
      <p className="mt-2 text-sm font-light text-slate-400">
        From birthday parties to blackouts, this generator has you covered.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {useCases.map((item) => (
          <div
            key={item.title}
            className="gen-card rounded-lg border border-slate-700/50 bg-[#0a0e27] p-5"
          >
            <div className="text-3xl">{item.emoji}</div>
            <h3 className="mt-3 font-black tracking-wide text-white uppercase">
              {item.title}
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-slate-400">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
