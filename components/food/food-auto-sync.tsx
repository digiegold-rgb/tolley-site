"use client";

import { useEffect, useState, useCallback } from "react";

type StoreKey = "walmart" | "samsclub";

interface StoreState {
  store: StoreKey;
  label: string;
  loggedIn: boolean;
  cookieAgeDays: number | null;
  lastFetchAt: string | null;
  lastIngestAt: string | null;
  error: string | null;
}

interface StatusResponse {
  walmart: StoreState;
  samsclub: StoreState;
}

const STORE_META: Record<StoreKey, { emoji: string; loginCmd: string }> = {
  walmart: { emoji: "🛒", loginCmd: "node ~/grocery-scraper/src/login.js walmart" },
  samsclub: { emoji: "🏬", loginCmd: "node ~/grocery-scraper/src/login.js samsclub" },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function FoodAutoSync() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<StoreKey | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/food/import/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as StatusResponse;
      setStatus(data);
    } catch (err) {
      setToast({ kind: "err", msg: err instanceof Error ? err.message : "Status check failed" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sync = async (store: StoreKey) => {
    setSyncing(store);
    setToast(null);
    try {
      const res = await fetch(`/api/food/import/${store}-auto`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 412) {
          setToast({ kind: "err", msg: `Not logged in. Run: ${STORE_META[store].loginCmd}` });
        } else {
          setToast({ kind: "err", msg: body.error || `Sync failed (${res.status})` });
        }
        return;
      }
      const s = body.summary;
      setToast({
        kind: "ok",
        msg: s
          ? `Pulled ${s.orderCount} orders, ${s.totalItems} items ($${s.totalSpent}). Pantry updating in background.`
          : "Sync queued.",
      });
      // Background ingest needs ~5s — refresh status after.
      setTimeout(refresh, 4000);
    } catch (err) {
      setToast({ kind: "err", msg: err instanceof Error ? err.message : "Sync error" });
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <div className="food-card" style={{ padding: "1.25rem", marginBottom: "1.5rem", textAlign: "center", color: "var(--food-text-secondary)" }}>
        Checking store login status…
      </div>
    );
  }

  const stores: StoreKey[] = ["walmart", "samsclub"];

  return (
    <div className="food-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "1.5rem" }}>⚡</span>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)" }}>
          Auto-Sync from Stores
        </h2>
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginBottom: "1rem", lineHeight: 1.5 }}>
        Pulls your purchase history straight from each store. One-time login required (handles 2FA).
        Cookies persist ~30–60 days before re-login.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {stores.map((key) => {
          const s = status?.[key];
          if (!s) return null;
          const lastSync = formatRelative(s.lastIngestAt || s.lastFetchAt);
          const cookieAge = s.cookieAgeDays;
          return (
            <div
              key={key}
              style={{
                border: "1px solid var(--food-border)",
                borderRadius: "0.75rem",
                padding: "0.875rem 1rem",
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
                <span style={{ fontSize: "1.5rem" }}>{STORE_META[key].emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--food-text)" }}>{s.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>
                    {s.loggedIn ? (
                      <>✓ logged in · last sync {lastSync}{cookieAge != null ? ` · cookies ${cookieAge}d old` : ""}</>
                    ) : s.error ? (
                      <span style={{ color: "#c2410c" }}>⚠ {s.error}</span>
                    ) : (
                      <span style={{ color: "#c2410c" }}>⚠ not logged in</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                className="food-btn food-btn-primary"
                onClick={() => sync(key)}
                disabled={syncing === key || !s.loggedIn}
                style={{
                  opacity: syncing === key ? 0.7 : !s.loggedIn ? 0.4 : 1,
                  cursor: !s.loggedIn ? "not-allowed" : "pointer",
                }}
                title={!s.loggedIn ? `Run on DGX: ${STORE_META[key].loginCmd}` : "Pull latest orders"}
              >
                {syncing === key ? "Syncing…" : "Sync now"}
              </button>
            </div>
          );
        })}
      </div>

      {toast && (
        <div
          style={{
            marginTop: "0.875rem",
            padding: "0.625rem 0.75rem",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            background: toast.kind === "ok" ? "rgba(16,185,129,0.08)" : "rgba(244,114,182,0.08)",
            color: toast.kind === "ok" ? "#047857" : "#c2410c",
            border: `1px solid ${toast.kind === "ok" ? "rgba(16,185,129,0.3)" : "rgba(244,114,182,0.3)"}`,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
