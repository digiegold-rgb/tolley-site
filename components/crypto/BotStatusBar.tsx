"use client";

interface Props {
  online: boolean;
  mode: string;
  uptime?: number;
  trackedSymbols?: number;
  openPositions?: number;
  totalReturn?: number;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return "\u2014";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function BotStatusBar({ online, mode, uptime, trackedSymbols, openPositions, totalReturn }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6 py-2 px-4 rounded-lg bg-white/[0.02] border border-white/5">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            online ? "bg-green-400 pulse-gold" : "bg-red-400"
          }`}
        />
        <span className="text-xs text-white/50">
          Engine {online ? "Online" : "Offline"}
        </span>
      </div>
      <span className="text-xs text-white/10">|</span>
      <span className="text-xs text-white/50">
        Mode: <span className="text-amber-400">{mode}</span>
      </span>
      <span className="text-xs text-white/10">|</span>
      <span className="text-xs text-white/50">
        Uptime: <span className="text-white/70">{formatUptime(uptime)}</span>
      </span>
      {trackedSymbols != null && (
        <>
          <span className="text-xs text-white/10">|</span>
          <span className="text-xs text-white/50">
            Tracking: <span className="text-white/70">{trackedSymbols} symbols</span>
          </span>
        </>
      )}
      {openPositions != null && (
        <>
          <span className="text-xs text-white/10">|</span>
          <span className="text-xs text-white/50">
            Positions: <span className="text-white/70">{openPositions}</span>
          </span>
        </>
      )}
      {totalReturn != null && (
        <>
          <span className="text-xs text-white/10">|</span>
          <span className={`text-xs font-medium ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}% return
          </span>
        </>
      )}
    </div>
  );
}
