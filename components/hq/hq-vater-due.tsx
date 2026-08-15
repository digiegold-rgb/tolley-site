"use client";

/**
 * HqVaterDue — strip at the top of the /hq Must Complete tab showing Trey's
 * render bill: all-time total (never resets), paid to date, and current due.
 * "Zelle received" is a two-click confirm that records the full due as paid
 * (or an edited partial amount) via /api/hq/vater-payment. Bookkeeping of
 * money already received — it never moves money.
 */

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { readApiError } from "./types";

interface BreakdownRow {
  key: string;
  label: string;
  usd: number;
}

interface VaterDueSummary {
  totalUsd: number;
  paidUsd: number;
  dueUsd: number;
  videos: number;
  minutes: number;
  /** Category breakdown of the CURRENT due — recomputed after every Zelle. */
  since?: {
    from: string | null;
    basis: "snapshot" | "activity" | "all-time";
    totalUsd: number;
    carryoverUsd: number;
    rows: BreakdownRow[];
  } | null;
}

function sinceLabel(since: VaterDueSummary["since"]): string {
  if (!since) return "";
  if (!since.from) return "What makes up this bill";
  const d = new Date(since.from);
  return `New since ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function HqVaterDue() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<VaterDueSummary | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showRows, setShowRows] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/hq/vater-payment", { cache: "no-store" });
      if (!r.ok) return;
      const json = (await r.json()) as { summary: VaterDueSummary };
      setSummary(json.summary);
      setAmount(json.summary.dueUsd.toFixed(2));
    } catch {
      /* strip simply doesn't render */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!summary) return null;

  const parsed = Number(amount);
  const validAmount = Number.isFinite(parsed) && parsed > 0;

  const record = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/hq/vater-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsd: parsed, note: "Zelle — /hq reset" }),
      });
      if (!r.ok) {
        toast({ title: await readApiError(r, "Payment NOT recorded"), variant: "error" });
      } else {
        const json = (await r.json()) as { summary: VaterDueSummary };
        setSummary(json.summary);
        setAmount(json.summary.dueUsd.toFixed(2));
        toast({ title: `Recorded $${parsed.toFixed(2)} — due is now $${json.summary.dueUsd.toFixed(2)}`, variant: "success" });
      }
    } catch {
      toast({ title: "Network error — payment NOT recorded", variant: "error" });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const dueRows = summary.since?.rows ?? [];

  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 14,
        border: "1px solid var(--hq-border)",
        borderRadius: 10,
        background: "#fff",
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
      <strong>Trey render bill</strong>
      <span style={{ color: "#3a3a3c" }}>
        All-time <strong>${summary.totalUsd.toFixed(2)}</strong>
      </span>
      <span style={{ color: "#15803d" }}>
        Paid <strong>${summary.paidUsd.toFixed(2)}</strong>
      </span>
      <span style={{ color: summary.dueUsd > 0 ? "#b91c1c" : "#15803d" }}>
        Due <strong>${summary.dueUsd.toFixed(2)}</strong>
      </span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        {summary.dueUsd > 0 ? (
          <>
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirming(false);
              }}
              inputMode="decimal"
              style={{
                width: 80,
                padding: "5px 8px",
                border: "1px solid var(--hq-border)",
                borderRadius: 8,
                fontSize: 12,
                textAlign: "right",
              }}
            />
            <button
              onClick={() => void record()}
              disabled={busy || !validAmount}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: busy || !validAmount ? "default" : "pointer",
                background: confirming ? "#b91c1c" : "#15803d",
                color: "#fff",
                opacity: busy || !validAmount ? 0.6 : 1,
              }}
            >
              {busy
                ? "Saving…"
                : confirming
                  ? `Confirm $${validAmount ? parsed.toFixed(2) : "?"} received`
                  : "Zelle received"}
            </button>
            {confirming && !busy && (
              <button
                onClick={() => setConfirming(false)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid var(--hq-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>Paid up ✓</span>
        )}
      </span>
      </div>
      {dueRows.length > 0 && (
        <div style={{ marginTop: 8, borderTop: "1px solid #f0f0f2", paddingTop: 8 }}>
          <button
            onClick={() => setShowRows((v) => !v)}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color: "#6b7280",
            }}
          >
            {showRows ? "▾" : "▸"} {sinceLabel(summary.since)} — where the $
            {summary.dueUsd.toFixed(2)} went
          </button>
          {showRows && (
            <div style={{ marginTop: 6, maxWidth: 420 }}>
              {dueRows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "2px 0",
                    fontSize: 12,
                    color: "#3a3a3c",
                  }}
                >
                  <span>{row.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {row.usd < 0 ? "−" : ""}${Math.abs(row.usd).toFixed(2)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "4px 0 0",
                  marginTop: 4,
                  borderTop: "1px solid #f0f0f2",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>Current due</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  ${summary.dueUsd.toFixed(2)}
                </span>
              </div>
              {summary.since?.basis === "activity" && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>
                  Attributed by render activity — the last payment predates
                  snapshotting. The next Zelle makes this exact.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
