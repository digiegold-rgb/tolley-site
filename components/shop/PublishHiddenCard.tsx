"use client";

import { useEffect, useState } from "react";

interface DraftStats {
  publishable: number;
  missingPrice: number;
  missingImage: number;
  orphans: number;
  visible: number;
}

export function PublishHiddenCard() {
  const [stats, setStats] = useState<DraftStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/shop/admin/publish-drafts");
      if (!res.ok) return;
      setStats(await res.json());
    } catch {}
  }

  useEffect(() => {
    refresh();
  }, []);

  async function publishAll() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/shop/admin/publish-drafts", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMsg({
        kind: "ok",
        text: `Published ${data.published} drafts, healed ${data.healed} orphans.`,
      });
      await refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Publish failed" });
    } finally {
      setBusy(false);
    }
  }

  const total = (stats?.publishable ?? 0) + (stats?.orphans ?? 0);

  return (
    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-200">
            Publish hidden inventory
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            Promote drafts that have a photo + price to active listings on{" "}
            <code className="text-white/70">/shop</code>.
          </p>
        </div>
        <button
          onClick={publishAll}
          disabled={busy || total === 0}
          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
        >
          {busy
            ? "Publishing…"
            : total === 0
              ? "Nothing to publish"
              : `Publish ${total}`}
        </button>
      </div>

      {stats && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[0.7rem] text-white/55 sm:grid-cols-5">
          <Stat label="Publishable" value={stats.publishable} accent="text-emerald-300" />
          <Stat label="Orphans" value={stats.orphans} accent="text-amber-300" />
          <Stat label="Need price" value={stats.missingPrice} />
          <Stat label="No image" value={stats.missingImage} />
          <Stat label="Live now" value={stats.visible} accent="text-white" />
        </div>
      )}

      {msg && (
        <p
          className={`mt-2 text-xs ${
            msg.kind === "ok" ? "text-emerald-300" : "text-red-400"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md bg-white/[0.03] px-2 py-1.5">
      <p className="text-[0.6rem] uppercase tracking-wide text-white/40">{label}</p>
      <p className={`text-sm font-semibold ${accent ?? "text-white/70"}`}>{value}</p>
    </div>
  );
}
