interface KpiTile {
  label: string;
  value: number;
  tone?: "default" | "good" | "warning" | "alert";
}

export default function PipelineKpis({ tiles }: { tiles: KpiTile[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-lg shadow-sky-500/5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Pipeline</h2>
        <span className="text-[10px] uppercase tracking-wider text-sky-300/80">
          live
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className={`relative overflow-hidden rounded-xl border p-3 transition-transform hover:-translate-y-0.5 ${toneCard(tile.label, i)}`}
          >
            <div className={`text-2xl font-bold tracking-tight ${toneText(tile.label, i)}`}>
              {tile.value.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[11px] font-medium capitalize text-white/70">
              {tile.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Distinct pastel card per pipeline stage — sky, amber, mint, violet.
 * Falls back to index-based colors if labels don't match the known set.
 */
function toneCard(label: string, i: number): string {
  const palette = [
    "border-sky-400/30 bg-gradient-to-br from-sky-400/15 to-sky-400/5",
    "border-amber-400/30 bg-gradient-to-br from-amber-400/15 to-orange-400/5",
    "border-emerald-400/30 bg-gradient-to-br from-emerald-400/15 to-teal-400/5",
    "border-violet-400/30 bg-gradient-to-br from-violet-400/15 to-fuchsia-400/5",
  ];
  const byLabel: Record<string, string> = {
    new: palette[0],
    contacted: palette[1],
    interested: palette[2],
    closed: palette[3],
  };
  return byLabel[label] ?? palette[i % palette.length];
}

function toneText(label: string, i: number): string {
  const palette = [
    "text-sky-200",
    "text-amber-200",
    "text-emerald-200",
    "text-violet-200",
  ];
  const byLabel: Record<string, string> = {
    new: palette[0],
    contacted: palette[1],
    interested: palette[2],
    closed: palette[3],
  };
  return byLabel[label] ?? palette[i % palette.length];
}
