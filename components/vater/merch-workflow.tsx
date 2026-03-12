import { MERCH_STEPS } from "@/lib/vater";

export function MerchWorkflow() {
  return (
    <section>
      <h2 className="vater-section-title mb-2">How It Works</h2>
      <p className="vater-section-subtitle mb-10">
        Four automated steps from trend to doorstep.
      </p>

      <div className="flex flex-col gap-6">
        {MERCH_STEPS.map((s) => (
          <div key={s.step} className="vater-step" data-step={s.step}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xl" role="img" aria-label={s.title}>
                {s.icon}
              </span>
              <h3 className="text-lg font-bold text-slate-100">{s.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
