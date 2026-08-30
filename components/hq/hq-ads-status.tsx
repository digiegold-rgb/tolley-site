"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import {
  formatCost,
  formatCtr,
  formatInt,
  formatUsd,
  headerMetric,
  type AdsAccountBlock,
  type AdsLane,
  type AdsSnapshot,
} from "@/lib/hq-ads";

const LANE_META: Record<AdsLane, { label: string; fg: string }> = {
  keep: { label: "Keep", fg: "var(--hq-green)" },
  fade: { label: "Fade", fg: "var(--hq-amber)" },
  watch: { label: "Watch", fg: "var(--hq-blue)" },
  dark: { label: "Dark", fg: "var(--hq-red)" },
};

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function windowLabel(window: AdsAccountBlock["window"]): string {
  return window === "yesterday" ? "yesterday" : "today";
}

function headerLine(account: AdsAccountBlock): string {
  if (account.source === "placeholder") {
    return `${account.label} · placeholder`;
  }
  const metric = headerMetric(account, account.preferLpv);
  const metricBit = metric.kind === "LPV" ? `${formatInt(metric.value)} LPV` : `${formatInt(metric.value)} clk`;
  return `${account.label} · ${formatUsd(account.spend)} · ${metricBit} · ${formatInt(account.leads)} leads`;
}

function laneLine(names: string[]): string {
  return names.length ? names.join(" · ") : "—";
}

export function HqAdsStatus() {
  const { toast } = useToast();
  const [data, setData] = useState<AdsSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hq/ads-status")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as AdsSnapshot);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toast({
          title: "Ads status unavailable",
          description: e instanceof Error ? e.message : String(e),
          variant: "warning",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (!data) return null;

  const rows = data.accounts.flatMap((account) =>
    account.campaigns.map((c) => ({ account, campaign: c })),
  );
  const stale = Date.now() - Date.parse(data.asOf) > 26 * 3600_000;

  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        marginBottom: 10,
        background: "#fff",
        border: "1px solid var(--hq-line)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 2 }}>
          {data.accounts.map((account) => (
            <div key={account.key} style={{ fontSize: 13, fontWeight: 600 }}>
              {headerLine(account)}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--hq-ink-2)", marginLeft: 8 }}>
                {account.source === "placeholder" ? "awaiting ads API" : windowLabel(account.window)}
              </span>
            </div>
          ))}
        </div>
        <span
          style={{
            fontSize: 11,
            color: stale || data.source === "placeholder" ? "var(--hq-red)" : "var(--hq-ink-3)",
            fontWeight: stale ? 700 : 400,
          }}
        >
          {data.source === "placeholder"
            ? "placeholder"
            : stale
              ? `⚠︎ stale — ${ago(data.asOf)}`
              : ago(data.asOf)}
        </span>
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 8 }}>
          <table
            style={{
              width: "100%",
              minWidth: 520,
              borderCollapse: "collapse",
              fontVariantNumeric: "tabular-nums",
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ color: "var(--hq-ink-2)", textAlign: "right" }}>
                <th style={{ textAlign: "left", fontWeight: 600, padding: "3px 8px 3px 0" }}>Campaign</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }}>$</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }}>Imp</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }}>Clk</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }}>LPV</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }}>$/result</th>
                <th style={{ fontWeight: 600, padding: "3px 0 3px 6px" }}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account, campaign }) => (
                <tr key={`${account.key}-${campaign.id}`}>
                  <td
                    style={{
                      textAlign: "left",
                      fontWeight: 600,
                      padding: "3px 8px 3px 0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {campaign.displayName}
                  </td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{formatUsd(campaign.spend)}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{formatInt(campaign.impressions)}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{formatInt(campaign.clicks)}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{formatInt(campaign.lpv)}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{formatCost(campaign.costPerResult)}</td>
                  <td style={{ textAlign: "right", padding: "3px 0 3px 6px" }}>{formatCtr(campaign.ctr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 12 }}>
        {(["keep", "fade", "watch", "dark"] as AdsLane[]).map((lane) => (
          <div key={lane} style={{ display: "flex", gap: 10 }}>
            <span style={{ fontWeight: 700, width: 44, color: LANE_META[lane].fg }}>
              {LANE_META[lane].label}
            </span>
            <span style={{ color: data.lanes[lane].length ? "#1a1a1a" : "var(--hq-ink-3)" }}>
              {laneLine(data.lanes[lane])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
