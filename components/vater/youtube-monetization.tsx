import { YOUTUBE_MILESTONES } from "@/lib/vater";

export function YouTubeMonetization() {
  return (
    <section>
      <h2 className="vater-section-title">Revenue Milestones</h2>
      <p className="vater-section-subtitle mt-2">
        Growth targets from first dollar to full-time income.
      </p>

      <div className="mt-10">
        {YOUTUBE_MILESTONES.map((m) => (
          <div key={m.subs} className="vater-milestone">
            <div className="flex items-baseline gap-3">
              <span className="vater-neon text-2xl font-bold">{m.subs}</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                subscribers
              </span>
            </div>
            <p className="vater-neon-amber mt-1 text-lg font-bold">
              {m.revenue}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              {m.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
