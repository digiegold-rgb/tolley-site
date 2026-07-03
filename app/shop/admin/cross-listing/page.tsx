/**
 * Cross-listing platform health dashboard.
 *
 * Lives at /shop/admin/cross-listing. Renders 5 cards (FB / eBay / Mercari /
 * Poshmark / Depop) with current connection state pulled from
 * /api/shop/admin/cross-listing. The browser-session platforms (Mercari /
 * Poshmark / Depop) get Enable / Disable / Reconnect / Test buttons.
 *
 * The actual login flow happens on the DGX (`DISPLAY=:1 npm run login` in
 * the worker dir) — this page just instructs the operator and shows live
 * status from the worker's mirror sync.
 */

"use client";

import { useEffect, useState } from "react";

interface PlatformStatus {
  platform: string;
  ready: boolean;
  sessionState: string;
  lastError: string | null;
  lastLoginAt: string | null;
  lastListedAt: string | null;
  workerPort: number | null;
  notes: string | null;
}

const PRETTY: Record<string, string> = {
  fb_marketplace: "Facebook Marketplace",
  ebay: "eBay",
  mercari: "Mercari",
  poshmark: "Poshmark",
  depop: "Depop",
};

const STATE_COLOR: Record<string, string> = {
  connected: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  expired: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  checkpoint: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  disabled: "border-white/10 bg-white/5 text-white/50",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function CrossListingPage() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/admin/cross-listing", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPlatforms(json.platforms);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function action(platform: string, act: string) {
    setBusy(`${platform}:${act}`);
    setError(null);
    try {
      const res = await fetch("/api/shop/admin/cross-listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, action: act }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-white/90">
      <h1 className="mb-2 text-2xl font-semibold">Cross-listing</h1>
      <p className="mb-6 text-sm text-white/60">
        Each connected platform receives a draft job whenever a product is
        added or you click <strong>Cross-list now</strong> on a product. Sale
        state mirrors back from each platform every 10–15 minutes.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-white/50">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {platforms.map((p) => {
            const colorClass =
              STATE_COLOR[p.sessionState] || STATE_COLOR.disabled;
            const isBrowserSession = ["mercari", "poshmark", "depop"].includes(
              p.platform
            );
            return (
              <div
                key={p.platform}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold">
                      {PRETTY[p.platform] || p.platform}
                    </div>
                    <div className="text-xs text-white/40">
                      port {p.workerPort ?? "—"}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${colorClass}`}
                  >
                    {p.sessionState}
                  </span>
                </div>

                <dl className="mb-3 space-y-1 text-xs text-white/60">
                  <div className="flex justify-between">
                    <dt>Ready</dt>
                    <dd className={p.ready ? "text-emerald-300" : "text-white/40"}>
                      {p.ready ? "yes" : "no"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Last listed</dt>
                    <dd>{timeAgo(p.lastListedAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Last login</dt>
                    <dd>{timeAgo(p.lastLoginAt)}</dd>
                  </div>
                </dl>

                {p.lastError && (
                  <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[0.7rem] text-red-200">
                    {p.lastError}
                  </div>
                )}

                {p.notes && (
                  <div className="mb-3 rounded border border-white/10 bg-black/20 px-2 py-1 text-[0.7rem] text-white/60">
                    {p.notes}
                  </div>
                )}

                {isBrowserSession && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => action(p.platform, "enable")}
                      disabled={busy !== null}
                      className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[0.7rem] font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      Enable
                    </button>
                    <button
                      onClick={() => action(p.platform, "reconnect")}
                      disabled={busy !== null}
                      className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[0.7rem] font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
                    >
                      Reconnect
                    </button>
                    <button
                      onClick={() => action(p.platform, "disable")}
                      disabled={busy !== null}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] font-semibold text-white/60 hover:bg-white/10 disabled:opacity-50"
                    >
                      Disable
                    </button>
                    <button
                      onClick={() => action(p.platform, "test")}
                      disabled={busy !== null}
                      className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[0.7rem] font-semibold text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
                    >
                      Test
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60">
        <h2 className="mb-2 text-sm font-semibold text-white/80">
          One-time setup per browser-session platform
        </h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            SSH the DGX, <code className="text-white/70">cd ~/dgx-services/crosslist-&lt;platform&gt;-worker</code>
          </li>
          <li>
            <code className="text-white/70">DISPLAY=:1 npm run login</code> — log in once with 2FA
          </li>
          <li>
            <code className="text-white/70">sudo systemctl --user enable --now crosslist-&lt;platform&gt;-worker</code>
          </li>
          <li>
            Click <strong>Enable</strong> here — first mirror cycle flips state to <code className="text-white/70">connected</code>
          </li>
        </ol>
      </div>
    </div>
  );
}
