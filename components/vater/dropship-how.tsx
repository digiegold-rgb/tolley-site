import { DROPSHIP_STEPS } from "@/lib/vater";

export function DropshipHow() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h2 className="vater-section-title mb-3">How It Works</h2>
      <p className="vater-section-subtitle mb-10">
        Four automated steps from price gap to profit.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {DROPSHIP_STEPS.map((s) => (
          <div
            key={s.step}
            className="vater-card p-6"
          >
            <div className="vater-step" data-step={s.step}>
              <div className="mb-2 text-2xl" aria-hidden="true">
                {s.icon}
              </div>
              <h3 className="mb-1 text-lg font-bold text-white">{s.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                {s.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
