import { GOVBIDS_REQUIREMENTS } from "@/lib/vater";

export function GovBidsRequirements() {
  return (
    <section>
      <h2 className="vater-section-title mb-2">Requirements</h2>
      <p className="vater-section-subtitle mb-10">
        Everything you need before submitting your first bid.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GOVBIDS_REQUIREMENTS.map((req) => (
          <div key={req.item} className="vater-card p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-slate-100">{req.item}</h3>
              <span
                className={`vater-badge shrink-0 ${
                  req.required
                    ? ""
                    : "!border-amber-500/30 !bg-amber-500/8 !text-amber-400"
                }`}
              >
                {req.required ? "Required" : "Optional"}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {req.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
