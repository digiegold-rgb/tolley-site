import Link from "next/link";

interface HotLead {
  id: string;
  score: number;
  status: string;
  address: string;
  city: string | null;
  priceDropPct: number | null;
  daysOnMarket: number | null;
}

export default function TodayQueueWidget({
  leads,
  title = "Today's queue",
  subtitle,
}: {
  leads: HotLead[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-orange-500/5 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-orange-400/15 via-rose-400/10 to-transparent px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-white/60">{subtitle}</p>}
        </div>
        <Link
          href="/leads/pipeline"
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70 transition-colors hover:border-orange-300/40 hover:bg-orange-400/10 hover:text-orange-200"
        >
          View all →
        </Link>
      </div>
      <div className="divide-y divide-white/5">
        {leads.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-white/50">
            No hot leads right now. Adjust your farm area or import a CSV.
          </div>
        )}
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-orange-400/5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">
                {lead.address}
                {lead.city && (
                  <span className="text-white/50"> · {lead.city}</span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/55">
                <span className="capitalize">{lead.status}</span>
                {lead.priceDropPct != null && lead.priceDropPct > 0 && (
                  <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-amber-200">
                    −{lead.priceDropPct.toFixed(0)}%
                  </span>
                )}
                {lead.daysOnMarket != null && lead.daysOnMarket > 0 && (
                  <span>{lead.daysOnMarket}d</span>
                )}
              </div>
            </div>
            <ScorePill score={lead.score} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "bg-gradient-to-br from-emerald-400/25 to-teal-400/15 text-emerald-200 border-emerald-400/40 shadow-sm shadow-emerald-500/20"
      : score >= 40
      ? "bg-gradient-to-br from-amber-400/25 to-orange-400/15 text-amber-200 border-amber-400/40 shadow-sm shadow-amber-500/20"
      : "bg-white/5 text-white/60 border-white/15";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {score}
    </span>
  );
}
