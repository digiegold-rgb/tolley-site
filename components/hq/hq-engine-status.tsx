"use client";

import { useCallback, useEffect, useState } from "react";

// Always-visible health pill for the lead engine (the research-worker → MLS →
// dossier → Monday-digest chain). Polls /api/hq/engine-health every 60s.
// Green = leads fresh & digest-ready. Yellow = aging. Red = dry / engine down.
// This is the "is it really running" glance the product needs before it's sellable.

type Health = {
  status: "green" | "yellow" | "red";
  reasons: string[];
  metrics?: {
    listingAgeHours: number | null;
    listings7d: number;
    dossierAgeDays: number | null;
    qualifyingThisWeek: number;
    activeSubscribers: number;
  };
  checkedAt?: string;
};

const COLOR: Record<string, string> = { green: "#2da44e", yellow: "#d4a017", red: "#cf222e" };
const LABEL: Record<string, string> = { green: "Lead engine: LIVE", yellow: "Lead engine: AGING", red: "Lead engine: DRY" };

export function HqEngineStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/engine-health", { cache: "no-store" });
      const data = (await res.json()) as Health;
      setHealth(data);
      setErr(res.ok ? null : data.reasons?.join(", ") || "check failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const status = health?.status ?? (err ? "red" : "yellow");
  const m = health?.metrics;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Lead engine health — click for detail"
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
          border: "1px solid #d1d1d6", borderRadius: 999, background: "#fff",
          fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: COLOR[status],
          boxShadow: `0 0 0 3px ${COLOR[status]}22`,
        }} />
        {LABEL[status]}
        {m?.qualifyingThisWeek != null && (
          <span style={{ color: "#6e7781" }}>· {m.qualifyingThisWeek} ready</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          width: 280, background: "#fff", border: "1px solid #d1d1d6", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 12, fontSize: 12.5, color: "#1f2328",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Monday-digest engine</div>
          {health?.reasons && (
            <div style={{ color: COLOR[status], marginBottom: 8 }}>
              {health.reasons.join(" · ")}
            </div>
          )}
          <Row label="Newest listing" value={fmtH(m?.listingAgeHours)} />
          <Row label="Listings synced (7d)" value={m?.listings7d != null ? String(m.listings7d) : "—"} />
          <Row label="Seller scoring age" value={m?.dossierAgeDays != null ? `${m.dossierAgeDays}d` : "—"} />
          <Row label="Leads ready this week" value={m?.qualifyingThisWeek != null ? String(m.qualifyingThisWeek) : "—"} />
          <Row label="Active/trial subs" value={m?.activeSubscribers != null ? String(m.activeSubscribers) : "—"} />
          {err && <div style={{ color: "#cf222e", marginTop: 8 }}>{err}</div>}
          {health?.checkedAt && (
            <div style={{ color: "#8c959f", marginTop: 8, fontSize: 11 }}>
              checked {new Date(health.checkedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span style={{ color: "#6e7781" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function fmtH(h: number | null | undefined): string {
  if (h == null) return "never";
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
