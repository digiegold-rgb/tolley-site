"use client";

interface PlatformConnection {
  id: string;
  platform: string;
  platformUsername: string | null;
  pageName: string | null;
  status: string;
  lastError: string | null;
  tokenExpiresAt: string | null;
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  twitter: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  facebook: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  instagram: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  youtube: "bg-red-500/20 text-red-300 border-red-500/30",
  tiktok: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export default function PlatformCard({
  connection,
  onDisconnect,
}: {
  connection: PlatformConnection;
  onDisconnect: (id: string) => void;
}) {
  const colors = PLATFORM_COLORS[connection.platform] || "bg-white/10 text-white/60 border-white/20";
  const label = PLATFORM_LABELS[connection.platform] || connection.platform;
  const isExpired = connection.status === "expired" || connection.status === "error";

  return (
    <div className={`rounded-xl border p-4 ${colors}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs opacity-60 mt-0.5">
            @{connection.platformUsername || connection.pageName || "connected"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              isExpired ? "bg-red-400" : "bg-green-400"
            }`}
          />
          <span className="text-xs opacity-60">{connection.status}</span>
        </div>
      </div>

      {connection.lastError && (
        <div className="mt-2 text-xs text-red-300/80 bg-red-500/10 rounded-lg px-2 py-1">
          {connection.lastError}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onDisconnect(connection.id)}
          className="text-xs text-white/30 hover:text-red-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

export function ConnectPlatformButton({
  platform,
  onConnect,
  disabled,
}: {
  platform: string;
  onConnect: (platform: string) => void;
  disabled?: boolean;
}) {
  const colors = PLATFORM_COLORS[platform] || "bg-white/5 text-white/40 border-white/10";
  const label = PLATFORM_LABELS[platform] || platform;

  return (
    <button
      onClick={() => onConnect(platform)}
      disabled={disabled}
      className={`rounded-xl border border-dashed p-4 text-left hover:border-solid transition-all disabled:opacity-50 ${colors.replace(/\/20/g, "/10").replace(/\/30/g, "/20")}`}
    >
      <div className="text-sm font-medium opacity-60">{label}</div>
      <div className="text-xs opacity-30 mt-1">Click to connect</div>
    </button>
  );
}
