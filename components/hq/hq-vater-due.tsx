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

interface VaterDueSummary {
  totalUsd: number;
  paidUsd: number;
  dueUsd: number;
  videos: number;
  minutes: number;
}

export function HqVaterDue() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<VaterDueSummary | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        padding: "10px 14px",
        marginBottom: 14,
        border: "1px solid #d1d1d6",
        borderRadius: 10,
        background: "#fff",
        fontSize: 13,
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
                border: "1px solid #d1d1d6",
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
                  border: "1px solid #d1d1d6",
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
  );
}
