import { GEN_FAQ } from "@/lib/generator";


export function GeneratorFaq() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1030] p-6 sm:p-8">
      <h2 className="gen-neon-text text-2xl font-black tracking-wide text-yellow-400 uppercase sm:text-3xl">
        FAQ
      </h2>
      <div className="mt-5 space-y-3">
        {GEN_FAQ.map((item) => (
          <div
            key={item.q}
            className="gen-card rounded-lg border border-slate-700/50 bg-[#0a0e27] p-5"
          >
            <h3 className="font-black tracking-wide text-white uppercase">
              {item.q}
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-slate-400">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
