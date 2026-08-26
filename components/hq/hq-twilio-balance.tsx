"use client";

import { useCallback, useEffect, useState } from "react";

import { readApiError } from "./types";

// Keep these in sync with lib/twilio-balance.ts. Do not import that file here —
// it talks to Twilio with the Account SID and must stay server-only.
const TWILIO_LOW_BALANCE_USD = 5;
const TWILIO_CONSOLE_BILLING_URL =
  "https://console.twilio.com/us1/billing/manage-billing/billing-overview";

export type HqTwilioBalanceData = {
  balance: number;
  currency: string;
  asOf: string;
};

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fetchedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function useTwilioBalance() {
  const [data, setData] = useState<HqTwilioBalanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/hq/twilio-balance", { cache: "no-store" });
      if (!r.ok) throw new Error(await readApiError(r, "Twilio balance unavailable"));
      const json = (await r.json()) as HqTwilioBalanceData;
      if (typeof json.balance !== "number" || typeof json.currency !== "string") {
        throw new Error("Twilio balance unavailable");
      }
      setData({
        balance: json.balance,
        currency: json.currency,
        asOf: typeof json.asOf === "string" ? json.asOf : new Date().toISOString(),
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Twilio balance unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}

const TOP_UP_HREF = TWILIO_CONSOLE_BILLING_URL;
const TOP_UP_LABEL = "Top up in Twilio Console";

function TopUpLink({ compact }: { compact?: boolean }) {
  return (
    <a
      href={TOP_UP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={compact ? "twilio-topup twilio-topup-sm" : "twilio-topup"}
    >
      {TOP_UP_LABEL} →
    </a>
  );
}

/** Money-tab card — live prepaid SMS balance, refresh on load + click. */
export function HqTwilioBalanceCard() {
  const { data, error, loading, refresh } = useTwilioBalance();
  const low = data != null && data.balance < TWILIO_LOW_BALANCE_USD;

  return (
    <div className="panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Twilio{" "}
          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--hq-ink-2)" }}>
            prepaid SMS balance
          </span>
        </div>
        <button className="btn btn-sm" onClick={() => void refresh()} disabled={loading} type="button">
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {data ? (
        <>
          <div
            className="val"
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: low ? "var(--hq-red)" : "#1a1a1a",
            }}
          >
            {usd(data.balance)}
          </div>
          <div style={{ fontSize: 11, color: "var(--hq-ink-2)", marginTop: 2 }}>
            Fetched {fetchedAt(data.asOf)}
            {data.currency && data.currency !== "USD" ? ` · ${data.currency}` : ""}
          </div>
          {low && (
            <div className="twilio-low-warn" role="status">
              Low — top up in Twilio
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <TopUpLink />
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: error ? "var(--hq-red)" : "#999", padding: "4px 0" }}>
          {loading ? "Loading Twilio balance…" : error ?? "No Twilio balance loaded."}
        </div>
      )}

      {data && error && (
        <div style={{ fontSize: 12, color: "var(--hq-red)", marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}

/** Compact SMS-tab header chip — same number, no polling. */
export function HqTwilioBalancePill() {
  const { data, error, loading, refresh } = useTwilioBalance();
  const low = data != null && data.balance < TWILIO_LOW_BALANCE_USD;

  return (
    <div className={`twilio-pill${low ? " low" : ""}`} title={data ? `Fetched ${fetchedAt(data.asOf)}` : undefined}>
      <span className="twilio-pill-amt">
        Twilio {data ? usd(data.balance) : loading ? "…" : "—"}
      </span>
      {low && <span className="twilio-pill-low">Low — top up in Twilio</span>}
      {!data && error && !loading && (
        <span className="twilio-pill-err" title={error}>
          {error}
        </span>
      )}
      <TopUpLink compact />
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => void refresh()}
        disabled={loading}
        title="Refresh Twilio balance"
        aria-label="Refresh Twilio balance"
      >
        {loading ? "…" : "↻"}
      </button>
    </div>
  );
}
