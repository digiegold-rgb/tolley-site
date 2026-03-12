import { GOVBIDS_STEPS } from "@/lib/vater";

export function GovBidsProcess() {
  return (
    <section>
      <h2 className="vater-section-title mb-2">How It Works</h2>
      <p className="vater-section-subtitle mb-10">
        Four-step pipeline from solicitation to delivery.
      </p>

      <div className="space-y-6">
        {GOVBIDS_STEPS.map((s) => (
          <div key={s.step} className="vater-step" data-step={s.step}>
            <div className="flex items-start gap-3">
              <span className="text-2xl" role="img" aria-label={s.title}>
                {s.icon}
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-100">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  {s.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
