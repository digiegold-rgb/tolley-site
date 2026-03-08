import { MV_BUNDLE } from "@/lib/moving";

export function MovingBundle() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
      <h2 className="mv-neon-text text-2xl font-black tracking-wide text-emerald-400 uppercase sm:text-3xl">
        What You Get
      </h2>
      <p className="mt-2 text-sm font-light text-neutral-400">
        One bundle. Everything you need. No trips to the store.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {MV_BUNDLE.map((item) => (
          <div
            key={item.item}
            className="mv-card rounded-lg border border-neutral-800 bg-neutral-950 p-5 text-center"
          >
            <span className="text-4xl font-black text-emerald-400">{item.qty}</span>
            <h3 className="mt-2 font-black tracking-wide text-white uppercase">
              {item.item}
            </h3>
            <p className="mt-1 text-sm font-light text-neutral-500">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
