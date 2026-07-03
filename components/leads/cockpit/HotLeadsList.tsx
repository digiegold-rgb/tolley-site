import Link from "next/link";

interface HotLead {
  id: string;
  score: number;
  address: string;
  city: string | null;
  listPrice: number | null;
}

export default function HotLeadsList({ leads }: { leads: HotLead[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-emerald-500/5 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-emerald-400/15 via-teal-400/10 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <h2 className="text-sm font-semibold text-white">Hot leads</h2>
        </div>
        <Link
          href="/leads/people?list=hot"
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70 transition-colors hover:border-emerald-300/40 hover:bg-emerald-400/10 hover:text-emerald-200"
        >
          All →
        </Link>
      </div>
      <div className="divide-y divide-white/5">
        {leads.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-white/50">
            No hot leads yet.
          </div>
        )}
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-emerald-400/5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-white">
                {lead.address}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/55">
                {lead.city && <span>{lead.city}</span>}
                {lead.listPrice && (
                  <span className="text-sky-300">
                    ${(lead.listPrice / 1000).toFixed(0)}k
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-400/40 bg-gradient-to-br from-emerald-400/25 to-teal-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 shadow-sm shadow-emerald-500/20">
              {lead.score}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
