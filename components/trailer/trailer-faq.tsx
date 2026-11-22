import { TR_FAQ } from "@/lib/trailer";


export function TrailerFaq() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
      <h2 className="text-2xl font-black tracking-wide text-amber-400 uppercase sm:text-3xl">
        FAQ
      </h2>
      <div className="mt-5 space-y-3">
        {TR_FAQ.map((item) => (
          <div
            key={item.q}
            className="trailer-card rounded-lg border border-neutral-800 bg-neutral-950 p-5"
          >
            <h3 className="font-black tracking-wide text-white uppercase">
              {item.q}
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-neutral-400">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
