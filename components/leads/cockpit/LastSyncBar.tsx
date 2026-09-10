export default function LastSyncBar({
  lastSyncAt,
  asOf,
  listingCount,
  leadCount,
}: {
  lastSyncAt: string | null;
  asOf: string;
  listingCount: number;
  leadCount: number;
}) {
  const age = lastSyncAt ? new Date(asOf).getTime() - new Date(lastSyncAt).getTime() : Infinity;
  const fresh = Number.isFinite(age) && age >= 0 && age < 36 * 3600000;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/20 bg-gradient-to-r from-emerald-400/10 via-white/[0.06] to-sky-400/10 px-4 py-2.5 text-[11px] text-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] backdrop-blur">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {fresh && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${fresh ? "bg-emerald-400" : "bg-amber-300"}`} />
        </span>
        <span className="text-white/80">
          Last successful MLS sync:{" "}
          <span className={fresh ? "text-emerald-300" : "text-amber-200"}>
            {lastSyncAt ? formatRelative(lastSyncAt, asOf) : "never"}
          </span>
        </span>
      </span>
      <span className="text-white/20">·</span>
      <span>
        <span className="text-sky-300">{listingCount.toLocaleString()}</span>{" "}
        listings
      </span>
      <span className="text-white/20">·</span>
      <span>
        <span className="text-violet-300">{leadCount.toLocaleString()}</span>{" "}
        leads scored
      </span>
    </div>
  );
}

function formatRelative(iso: string, asOf: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = new Date(asOf).getTime() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
