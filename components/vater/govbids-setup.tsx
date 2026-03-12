import { GOVBIDS_SETUP } from "@/lib/vater";

const STATUS_ICON: Record<string, string> = {
  required: "\u2713",
  recommended: "\u25CB",
  optional: "\u25CB",
};

export function GovBidsSetup() {
  return (
    <section>
      <h2 className="vater-section-title mb-2">Setup Checklist</h2>
      <p className="vater-section-subtitle mb-10">
        Get these accounts and credentials in place to launch.
      </p>

      <ul className="vater-checklist space-y-3">
        {GOVBIDS_SETUP.map((entry) => (
          <li key={entry.item}>
            <span className="check-icon">
              {STATUS_ICON[entry.status] ?? "\u2713"}
            </span>
            <span className="flex-1 text-sm text-slate-200">{entry.item}</span>
            <span
              className={`vater-badge text-[0.65rem] ${
                entry.status === "required"
                  ? ""
                  : "!border-amber-500/30 !bg-amber-500/8 !text-amber-400"
              }`}
            >
              {entry.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
