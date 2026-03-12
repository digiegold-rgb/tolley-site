import { MERCH_SETUP } from "@/lib/vater";

const STATUS_COLORS: Record<string, string> = {
  required: "text-sky-400 border-sky-400/40 bg-sky-400/10",
  optional: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  recommended: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
};

export function MerchSetup() {
  return (
    <section>
      <h2 className="vater-section-title mb-2">Setup Checklist</h2>
      <p className="vater-section-subtitle mb-10">
        Everything you need before launch.
      </p>

      <ul className="vater-checklist flex flex-col gap-3">
        {MERCH_SETUP.map((entry) => (
          <li key={entry.item}>
            <span className="check-icon" aria-hidden="true">
              {entry.status === "required" ? "!" : "~"}
            </span>
            <span className="flex-1 text-sm text-slate-300">{entry.item}</span>
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${STATUS_COLORS[entry.status] ?? "text-slate-400"}`}
            >
              {entry.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
