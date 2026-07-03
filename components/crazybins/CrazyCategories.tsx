import { CRAZY } from "@/app/crazybins/data";

export function CrazyCategories() {
  return (
    <section className="bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="crazy-enter text-center">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#e63946]">What's Inside · Qué Encontrarás</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#1d2d50] sm:text-5xl">
            Anything You Name It, <span className="text-[#ff6b1a]">We Got It.</span>
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
          {CRAZY.categories.map((c, i) => (
            <div
              key={c.en}
              className={`crazy-tile crazy-enter relative overflow-hidden rounded-3xl bg-gradient-to-br ${c.color} p-6 text-center shadow-lg sm:p-8`}
              style={{ "--enter-delay": `${i * 0.06}s` } as React.CSSProperties}
            >
              <div className="text-5xl drop-shadow-md sm:text-6xl">{c.emoji}</div>
              <div className="mt-3 text-lg font-black uppercase tracking-wide text-white drop-shadow sm:text-xl">{c.en}</div>
              <div className="text-sm font-semibold italic text-white/85">{c.es}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
