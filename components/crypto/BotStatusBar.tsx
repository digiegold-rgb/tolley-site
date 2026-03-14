"use client";

interface Props {
  online: boolean;
  mode: string;
  uptime?: number;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${m}m`;
}

export default function BotStatusBar({ online, mode, uptime }: Props) {
  return (
    <div className="flex items-center gap-4 mb-6 py-2 px-4 rounded-lg bg-white/[0.02] border border-white/5">
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
      <div className="text-xs text-white/30">|</div>
      <div className="text-xs text-white/50">
        Mode: <span className="text-amber-400">{mode}</span>
      </div>
      <div className="text-xs text-white/30">|</div>
      <div className="text-xs text-white/50">
        Uptime: <span className="text-white/70">{formatUptime(uptime)}</span>
      </div>
    </div>
  );
}
