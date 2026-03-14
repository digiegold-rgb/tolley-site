"use client";

import { useState } from "react";

interface Props {
  online: boolean;
  mode: string;
  uptime?: number;
  trackedSymbols?: number;
  openPositions?: number;
  totalReturn?: number;
  proxyEnabled?: boolean;
  dataSources?: number;
  tier4Count?: number;
  validationReady?: boolean;
  sharpe?: number;
  onModeSwitch?: (mode: string) => Promise<void>;
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

export default function BotStatusBar({ online, mode, uptime, trackedSymbols, openPositions, totalReturn, proxyEnabled, dataSources, tier4Count, validationReady, sharpe, onModeSwitch }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleModeToggle = async () => {
    if (mode === "paper" && !validationReady) return;
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);
    setSwitching(true);
    try {
      const target = mode === "paper" ? "live" : "paper";
      if (onModeSwitch) await onModeSwitch(target);
    } finally {
      setSwitching(false);
    }
  };

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
      {proxyEnabled != null && (
        <>
          <span className="text-xs text-white/10">|</span>
          <span className="text-xs text-white/50">
            VPN: <span className={proxyEnabled ? "text-green-400" : "text-white/30"}>{proxyEnabled ? "Mullvad" : "Off"}</span>
          </span>
        </>
      )}
      {tier4Count != null && tier4Count > 0 && (
        <>
          <span className="text-xs text-white/10">|</span>
          <span className="text-xs text-amber-400/70">
            {tier4Count} degen
          </span>
        </>
      )}
      {sharpe != null && (
        <>
          <span className="text-xs text-white/10">|</span>
          <span className={`text-xs ${sharpe >= 0.5 ? "text-green-400" : "text-white/50"}`}>
            Sharpe: {sharpe.toFixed(2)}
          </span>
        </>
      )}
      {onModeSwitch && (
        <>
          <span className="text-xs text-white/10">|</span>
          <div className="flex items-center gap-1.5">
            {showConfirm ? (
              <>
                <span className="text-xs text-red-400">
                  Switch to {mode === "paper" ? "LIVE" : "PAPER"}?
                </span>
                <button
                  onClick={handleModeToggle}
                  disabled={switching}
                  className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                >
                  {switching ? "..." : "Confirm"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 hover:text-white/60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleModeToggle}
                disabled={mode === "paper" && !validationReady}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  mode === "live"
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : validationReady
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      : "bg-white/5 text-white/20 cursor-not-allowed"
                }`}
                title={mode === "paper" && !validationReady ? "Validation not passed" : ""}
              >
                {mode === "live" ? "Go Paper" : "Go Live"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
