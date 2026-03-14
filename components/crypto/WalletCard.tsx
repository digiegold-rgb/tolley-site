"use client";

interface ExchangeStatus {
  connected: boolean;
  last_sync: string | null;
}

interface Props {
  exchangeStatus?: {
    gateio: ExchangeStatus;
    coinbase: ExchangeStatus;
  };
  cash?: number;
  mode?: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function WalletCard({ exchangeStatus, cash, mode }: Props) {
  const gateio = exchangeStatus?.gateio;
  const coinbase = exchangeStatus?.coinbase;

  return (
    <div className="crypto-card">
      <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Exchange Connections</h3>

      <div className="space-y-3">
        {/* Gate.io */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              gateio?.connected ? "bg-green-400" : "bg-white/20"
            }`} />
            <span className="text-sm text-white/70">Gate.io</span>
          </div>
          <div className="text-right">
            <span className={`text-xs ${gateio?.connected ? "text-green-400" : "text-white/30"}`}>
              {gateio?.connected ? "Connected" : "Disconnected"}
            </span>
            {gateio?.last_sync && (
              <p className="text-[10px] text-white/20">Synced {formatTime(gateio.last_sync)}</p>
            )}
          </div>
        </div>

        {/* Coinbase */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              coinbase?.connected ? "bg-green-400" : "bg-white/20"
            }`} />
            <span className="text-sm text-white/70">Coinbase</span>
          </div>
          <div className="text-right">
            <span className={`text-xs ${coinbase?.connected ? "text-green-400" : "text-white/30"}`}>
              {coinbase?.connected ? "Connected" : "No credentials"}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Available Cash</span>
            <span className="text-white font-medium">${(cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-white/40">Trading Mode</span>
            <span className={`font-medium ${mode === "live" ? "text-red-400" : "text-amber-400"}`}>
              {mode === "live" ? "LIVE" : "Paper"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
