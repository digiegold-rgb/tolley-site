import { YOUTUBE_SETUP } from "@/lib/vater";

export function YouTubeSetup() {
  return (
    <section>
      <h2 className="vater-section-title">Setup Checklist</h2>
      <p className="vater-section-subtitle mt-2">
        Everything you need before the pipeline goes live.
      </p>

      <ul className="vater-checklist mt-8 space-y-3">
        {YOUTUBE_SETUP.map((entry) => (
          <li key={entry.item}>
            <span className="check-icon" aria-hidden="true">
              &#10003;
            </span>
            <span className="flex-1 text-sm text-slate-300">{entry.item}</span>
            <span
              className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                entry.status === "required"
                  ? "border border-sky-400/30 bg-sky-400/10 text-sky-400"
                  : "border border-amber-400/30 bg-amber-400/10 text-amber-400"
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
