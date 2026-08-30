"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/Toast";
import {
  ADS_LANE_COLOR,
  ADS_SIGNAL_COLOR,
  allTimeTooltip,
  colTooltip,
  costSignal,
  ctrSignal,
  daySpendSignal,
  formatCost,
  formatCtr,
  formatInt,
  formatUsd,
  headerColTitle,
  headerMetric,
  headerMetricTooltip,
  laneTooltip,
  leadsSignal,
  leadsTooltip,
  mutedRow,
  windowTooltip,
  type AdsAccountBlock,
  type AdsCampaignRow,
  type AdsLane,
  type AdsSignal,
  type AdsSnapshot,
} from "@/lib/hq-ads";

const LANE_META: Record<AdsLane, { label: string }> = {
  keep: { label: "Keep" },
  fade: { label: "Fade" },
  watch: { label: "Watch" },
  dark: { label: "Dark" },
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

function laneLine(names: string[]): string {
  return names.length ? names.join(" · ") : "—";
}

function ink(signal: AdsSignal): string {
  return ADS_SIGNAL_COLOR[signal];
}

function Tip({
  title,
  children,
  color,
  weight,
}: {
  title: string;
  children: ReactNode;
  color?: string;
  weight?: number;
}) {
  return (
    <span title={title} style={{ color, fontWeight: weight, cursor: "help" }}>
      {children}
    </span>
  );
}

function accountLaneHint(account: AdsAccountBlock): AdsLane {
  if (account.campaigns.some((c) => c.lane === "keep")) return "keep";
  if (account.campaigns.some((c) => c.lane === "watch")) return "watch";
  if (account.campaigns.some((c) => c.lane === "fade")) return "fade";
  return "dark";
}

function AccountHeader({ account }: { account: AdsAccountBlock }) {
  if (account.source === "placeholder") {
    return (
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {account.label} · placeholder
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--hq-ink-2)", marginLeft: 8 }}>
          awaiting ads API
        </span>
      </div>
    );
  }
  const hint = accountLaneHint(account);
  const metric = headerMetric(account, account.preferLpv);
  const leadsSig = leadsSignal(account.leads, hint);
  const daySig = daySpendSignal(account.spend, hint);
  return (
    <div style={{ fontSize: 13, fontWeight: 600 }}>
      {account.label}
      {" · "}
      <Tip title={windowTooltip(account.window)} color={ink(daySig)}>
        {formatUsd(account.spend)} {windowLabel(account.window)}
      </Tip>
      {" · "}
      <Tip title={allTimeTooltip()}>
        {formatUsd(account.lifetimeSpend)} all-time
      </Tip>
      {" · "}
      <Tip title={headerMetricTooltip(metric.kind, metric.value, account.leads, hint)}>
        {formatInt(metric.value)} {metric.kind === "LPV" ? "LPV" : "clk"}
      </Tip>
      {" · "}
      <Tip title={leadsTooltip(account.leads, hint)} color={ink(leadsSig)}>
        {formatInt(account.leads)} leads
      </Tip>
    </div>
  );
}

function Row({
  campaign,
  preferLpv,
}: {
  campaign: AdsCampaignRow;
  preferLpv: boolean;
}) {
  const mute = mutedRow(campaign.lane);
  const base = mute ? ink("muted") : ink("neutral");
  return (
    <tr style={{ color: base }}>
      <td
        style={{
          textAlign: "left",
          fontWeight: 600,
          padding: "3px 8px 3px 0",
          whiteSpace: "nowrap",
          color: mute ? ink("muted") : ADS_LANE_COLOR[campaign.lane],
        }}
        title={laneTooltip(campaign.lane)}
      >
        {campaign.displayName}
      </td>
      <td style={{ textAlign: "right", padding: "3px 6px", color: ink(daySpendSignal(campaign.spend, campaign.lane)) }} title={colTooltip("day$", campaign, preferLpv)}>
        {formatUsd(campaign.spend)}
      </td>
      <td style={{ textAlign: "right", padding: "3px 6px" }} title={colTooltip("life$", campaign, preferLpv)}>
        {formatUsd(campaign.lifetimeSpend)}
      </td>
      <td style={{ textAlign: "right", padding: "3px 6px" }} title={colTooltip("imp", campaign, preferLpv)}>
        {formatInt(campaign.impressions)}
      </td>
      <td style={{ textAlign: "right", padding: "3px 6px" }} title={colTooltip("clk", campaign, preferLpv)}>
        {formatInt(campaign.clicks)}
      </td>
      <td style={{ textAlign: "right", padding: "3px 6px" }} title={colTooltip("lpv", campaign, preferLpv)}>
        {formatInt(campaign.lpv)}
      </td>
      <td style={{ textAlign: "right", padding: "3px 6px", color: ink(costSignal(campaign.costPerResult, preferLpv, campaign.lane)) }} title={colTooltip("cpr", campaign, preferLpv)}>
        {formatCost(campaign.costPerResult)}
      </td>
      <td style={{ textAlign: "right", padding: "3px 0 3px 6px", color: ink(ctrSignal(campaign.ctr, campaign.lane)) }} title={colTooltip("ctr", campaign, preferLpv)}>
        {formatCtr(campaign.ctr)}
      </td>
    </tr>
  );
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
            <AccountHeader key={account.key} account={account} />
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
              minWidth: 580,
              borderCollapse: "collapse",
              fontVariantNumeric: "tabular-nums",
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ color: "var(--hq-ink-2)", textAlign: "right" }}>
                <th style={{ textAlign: "left", fontWeight: 600, padding: "3px 8px 3px 0" }}>Campaign</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }} title={headerColTitle("day$")}>Day $</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }} title={headerColTitle("life$")}>Life $</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }} title={headerColTitle("imp")}>Imp</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }} title={headerColTitle("clk")}>Clk</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }} title={headerColTitle("lpv")}>LPV</th>
                <th style={{ fontWeight: 600, padding: "3px 6px" }} title={headerColTitle("cpr")}>$/result</th>
                <th style={{ fontWeight: 600, padding: "3px 0 3px 6px" }} title={headerColTitle("ctr")}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account, campaign }) => (
                <Row key={`${account.key}-${campaign.id}`} campaign={campaign} preferLpv={account.preferLpv} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 12 }}>
        {(["keep", "fade", "watch", "dark"] as AdsLane[]).map((lane) => (
          <div key={lane} style={{ display: "flex", gap: 10 }} title={laneTooltip(lane)}>
            <span style={{ fontWeight: 700, width: 44, color: ADS_LANE_COLOR[lane], cursor: "help" }}>
              {LANE_META[lane].label}
            </span>
            <span style={{ color: data.lanes[lane].length ? ADS_LANE_COLOR[lane] : "var(--hq-ink-3)" }}>
              {laneLine(data.lanes[lane])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
