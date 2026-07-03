"use client";

import { useEffect, useState } from "react";

interface EbayStatus {
  connected: boolean;
  environment: string;
  sellerEbayId: string | null;
  refreshTokenExpiresAt: string;
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
  fulfillmentPolicyId: string | null;
  defaultLocationKey: string | null;
  lastRefreshError: string | null;
  updatedAt: string;
}

export function EbayConnectionCard() {
  const [status, setStatus] = useState<EbayStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupMsg, setSetupMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ebay_connected") === "1") {
      setSetupMsg({ kind: "ok", text: "eBay connected. Resolve policies + location next." });
    } else if (params.get("ebay_error")) {
      setSetupMsg({ kind: "err", text: `eBay connect failed: ${params.get("ebay_error")}` });
    }
    fetch("/api/ebay/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const policiesReady =
    status?.paymentPolicyId && status?.returnPolicyId && status?.fulfillmentPolicyId;

  async function runSetup() {
    setSetupBusy(true);
    setSetupMsg(null);
    try {
      const optin = await fetch("/api/ebay/optin", { method: "POST" }).then((r) => r.json());
      if (!optin.ok) {
        const detail = optin.optIn?.json?.errors?.[0]?.longMessage || "opt-in failed";
        setSetupMsg({ kind: "err", text: `Business Policy opt-in: ${detail}` });
        setSetupBusy(false);
        return;
      }
      const res = await fetch("/api/ebay/setup", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSetupMsg({ kind: "ok", text: "Opted in. Policies + location resolved." });
        const refreshed = await fetch("/api/ebay/status").then((r) => r.json());
        setStatus(refreshed.status ?? null);
      } else {
        setSetupMsg({ kind: "err", text: data.error || "setup failed" });
      }
    } catch (err) {
      setSetupMsg({ kind: "err", text: err instanceof Error ? err.message : "setup failed" });
    }
    setSetupBusy(false);
  }

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            eBay {status?.connected ? <span className="text-green-400">Connected</span> : <span className="text-white/40">Not connected</span>}
          </p>
          {status?.connected && (
            <p className="mt-0.5 text-xs text-white/40">
              {status.environment} · refresh expires {new Date(status.refreshTokenExpiresAt).toLocaleDateString()}
              {status.lastRefreshError ? ` · ⚠ ${status.lastRefreshError.slice(0, 60)}` : ""}
            </p>
          )}
        </div>
        {!status?.connected ? (
          <a
            href="/api/ebay/oauth/start"
            className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/30"
          >
            Connect eBay
          </a>
        ) : (
          <a
            href="/api/ebay/oauth/start"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/50 hover:border-white/25"
          >
            Reconnect
          </a>
        )}
      </div>
      {status?.connected && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/50">
          <div>Payment policy: {status.paymentPolicyId ? <span className="text-green-400">✓</span> : <span className="text-amber-400">missing</span>}</div>
          <div>Return policy: {status.returnPolicyId ? <span className="text-green-400">✓</span> : <span className="text-amber-400">missing</span>}</div>
          <div>Fulfillment policy: {status.fulfillmentPolicyId ? <span className="text-green-400">✓</span> : <span className="text-amber-400">missing</span>}</div>
          <div>Location: {status.defaultLocationKey ? <span className="text-green-400">✓</span> : <span className="text-amber-400">missing</span>}</div>
        </div>
      )}
      {status?.connected && !policiesReady && (
        <button
          onClick={runSetup}
          disabled={setupBusy}
          className="mt-3 w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          {setupBusy ? "Resolving…" : "Resolve policies + location"}
        </button>
      )}
      {setupMsg && (
        <p
          className={`mt-2 text-xs ${
            setupMsg.kind === "ok" ? "text-green-400" : "text-red-400"
          }`}
        >
          {setupMsg.text}
        </p>
      )}
    </div>
  );
}
