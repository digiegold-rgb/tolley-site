import { DROPSHIP_SETUP } from "@/lib/vater";

export function DropshipSetup() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h2 className="vater-section-title mb-3">Setup Checklist</h2>
      <p className="vater-section-subtitle mb-10">
        Everything you need to launch the arbitrage pipeline.
      </p>

      <ul className="vater-checklist space-y-3">
        {DROPSHIP_SETUP.map((item) => (
          <li key={item.item}>
            <span className="check-icon">
              {item.status === "required" ? (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path
                    d="M2 5l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <circle
                    cx="5"
                    cy="5"
                    r="2"
                    fill="currentColor"
                    opacity="0.5"
                  />
                </svg>
              )}
            </span>
            <span className="flex-1 text-sm text-slate-300">{item.item}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                item.status === "required"
                  ? "bg-sky-500/10 text-sky-400"
                  : item.status === "recommended"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-slate-500/10 text-slate-400"
              }`}
            >
              {item.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
