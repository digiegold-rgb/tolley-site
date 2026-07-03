export default function LastSyncBar({
  lastSyncAt,
  listingCount,
  leadCount,
}: {
  lastSyncAt: string | null;
  listingCount: number;
  leadCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/20 bg-gradient-to-r from-emerald-400/10 via-white/[0.06] to-sky-400/10 px-4 py-2.5 text-[11px] text-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] backdrop-blur">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-white/80">
          Last sync:{" "}
          <span className="text-emerald-300">
            {lastSyncAt ? formatRelative(lastSyncAt) : "never"}
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

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
