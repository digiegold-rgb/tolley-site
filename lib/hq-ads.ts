/**
 * lib/hq-ads.ts
 *
 * Read-only paid-ads snapshot for the /hq Posts tab.
 *
 * Collector talks to Zernio GET /v1/ads/campaigns only — never create, pause,
 * edit, or spend. Meta (Jelly Studio act_1029648474772753) is the priority;
 * X Digie Gold jelly1 (18ce55x53xp) is included when the same GET succeeds.
 * X Ads Manager remains source of truth if Zernio's today-window is empty.
 *
 * "Today" is America/Indiana/Indianapolis. 0 leads is a real metric.
 */

export const HQ_ADS_TZ = "America/Indiana/Indianapolis";

export const JELLY_META = {
  key: "jelly-meta",
  label: "Jelly Studio",
  platform: "facebook",
  zernioAccountId: "6a85dd4677555aae01129d27",
  adAccountId: "act_1029648474772753",
  includeEmpty: true,
  preferLpv: true,
} as const;

export const X_DIGIE = {
  key: "x-digie",
  label: "X Digie Gold",
  platform: "twitter",
  zernioAccountId: "6a8e758277555aae018ecc47",
  adAccountId: "18ce55x53xp",
  includeEmpty: false,
  preferLpv: false,
} as const;

export const HQ_AD_ACCOUNTS = [JELLY_META, X_DIGIE] as const;

export type HqAdAccountSpec = (typeof HQ_AD_ACCOUNTS)[number];

export type AdsWindow = "today" | "yesterday";
export type AdsLane = "keep" | "fade" | "watch" | "dark";
export type AdsSource = "live" | "placeholder";
export type AdsSignal = "good" | "soft" | "watch" | "muted" | "neutral";

export const ADS_SIGNAL_COLOR: Record<AdsSignal, string> = {
  good: "var(--hq-green)",
  soft: "var(--hq-amber)",
  watch: "#c2410c",
  muted: "var(--hq-ink-3)",
  neutral: "#1a1a1a",
};

export const ADS_LANE_COLOR: Record<AdsLane, string> = {
  keep: "var(--hq-green)",
  fade: "var(--hq-amber)",
  watch: "#c2410c",
  dark: "var(--hq-ink-3)",
};

export interface AdsCampaignRow {
  id: string;
  name: string;
  displayName: string;
  status: string;
  platformStatus: string;
  spend: number;
  lifetimeSpend: number;
  impressions: number;
  clicks: number;
  lpv: number;
  leads: number;
  ctr: number;
  costPerResult: number | null;
  lane: AdsLane;
}

export interface AdsAccountBlock {
  key: string;
  label: string;
  adAccountId: string;
  window: AdsWindow;
  source: AdsSource;
  preferLpv: boolean;
  spend: number;
  lifetimeSpend: number;
  lpv: number;
  clicks: number;
  leads: number;
  campaigns: AdsCampaignRow[];
  error?: string;
}

export interface AdsSnapshot {
  asOf: string;
  timezone: typeof HQ_ADS_TZ;
  day: string;
  source: AdsSource;
  accounts: AdsAccountBlock[];
  lanes: Record<AdsLane, string[]>;
}

export interface ZernioCampaignMetrics {
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  actions?: Record<string, number>;
  funnel?: { landingPageViews?: number; leads?: number };
}

export interface ZernioCampaign {
  platformCampaignId?: string;
  campaignName?: string;
  status?: string;
  platformCampaignStatus?: string;
  metrics?: ZernioCampaignMetrics;
}

export function indyDateKey(now: Date = new Date(), offsetDays = 0): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HQ_ADS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

export function yesterdayKey(now: Date = new Date()): string {
  // Walk back hour-by-hour until the Indianapolis calendar day changes.
  // A fixed -24h can land on the same civil day around DST, or skip one.
  const today = indyDateKey(now);
  for (let hours = 20; hours <= 36; hours++) {
    const candidate = new Date(now.getTime() - hours * 3_600_000);
    const key = indyDateKey(candidate);
    if (key !== today) return key;
  }
  return indyDateKey(now, -1);
}

/** Zernio caps a metrics range at 730 days — that is our all-time window. */
export function lifetimeFromKey(now: Date = new Date()): string {
  return indyDateKey(new Date(now.getTime() - 730 * 86_400_000));
}

export function shortCampaignName(name: string): string {
  let n = name.trim();
  n = n.replace(/^\[[^\]]+\]\s*/, "");
  n = n.replace(/^Animate\s+/i, "");
  const promoting = n.match(/^Promoting\s+(\S+)/i);
  if (promoting) {
    try {
      const url = new URL(promoting[1]);
      const utm = url.searchParams.get("utm_campaign");
      if (utm) return utm;
      const path = url.pathname.replace(/^\//, "");
      if (path) return path;
    } catch {
      /* keep stripped name */
    }
  }
  return n || name;
}

export function extractLpv(metrics: ZernioCampaignMetrics | undefined): number {
  if (!metrics) return 0;
  const funnel = metrics.funnel?.landingPageViews;
  if (typeof funnel === "number" && Number.isFinite(funnel)) return funnel;
  const actions = metrics.actions ?? {};
  const fromActions =
    actions.landing_page_view ??
    actions.omni_landing_page_view ??
    actions.landingPageView;
  return Number(fromActions) || 0;
}

export function extractLeads(metrics: ZernioCampaignMetrics | undefined): number {
  if (!metrics) return 0;
  const funnel = metrics.funnel?.leads;
  if (typeof funnel === "number" && Number.isFinite(funnel)) return funnel;
  const actions = metrics.actions ?? {};
  const fromActions = actions.lead ?? actions.onsite_conversion_lead_grouped;
  return Number(fromActions) || 0;
}

export function costPerResult(spend: number, lpv: number, leads: number, clicks: number): number | null {
  if (leads > 0) return spend / leads;
  if (lpv > 0) return spend / lpv;
  if (clicks > 0) return spend / clicks;
  return null;
}

export function classifyCampaign(status: string, platformStatus: string, spend: number): AdsLane {
  const platform = platformStatus.trim().toLowerCase();
  const derived = status.trim().toLowerCase();
  const raw = platform || derived;
  if (["archived", "deleted", "cancelled", "canceled", "rejected", "completed"].includes(raw)) {
    return "dark";
  }
  if (["paused", "campaign_paused", "adset_paused"].includes(raw)) return "fade";
  if (["active", "in_process", "pending_review"].includes(raw)) {
    return spend > 0 ? "keep" : "watch";
  }
  if (derived === "error" && ["paused", "campaign_paused"].includes(platform)) return "fade";
  if (derived === "error") return "dark";
  return spend > 0 ? "keep" : "dark";
}

export function accountHasDelivery(campaigns: AdsCampaignRow[]): boolean {
  return campaigns.some((c) => c.spend > 0 || c.impressions > 0);
}

export function mapZernioCampaign(raw: ZernioCampaign): AdsCampaignRow {
  const name = typeof raw.campaignName === "string" ? raw.campaignName : "(unnamed)";
  const spend = Number(raw.metrics?.spend) || 0;
  const impressions = Number(raw.metrics?.impressions) || 0;
  const clicks = Number(raw.metrics?.clicks) || 0;
  const lpv = extractLpv(raw.metrics);
  const leads = extractLeads(raw.metrics);
  const status = typeof raw.status === "string" ? raw.status : "";
  const platformStatus = typeof raw.platformCampaignStatus === "string" ? raw.platformCampaignStatus : "";
  return {
    id: typeof raw.platformCampaignId === "string" ? raw.platformCampaignId : name,
    name,
    displayName: shortCampaignName(name),
    status,
    platformStatus,
    spend,
    lifetimeSpend: 0,
    impressions,
    clicks,
    lpv,
    leads,
    ctr: Number(raw.metrics?.ctr) || 0,
    costPerResult: costPerResult(spend, lpv, leads, clicks),
    lane: classifyCampaign(status, platformStatus, spend),
  };
}

/** Copy lifetime spend onto the daily roster. Daily Imp/Clk/LPV/leads stay the day window. */
export function mergeLifetime(daily: AdsCampaignRow[], life: AdsCampaignRow[]): AdsCampaignRow[] {
  const lifeById = new Map(life.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const out = daily.map((c) => {
    seen.add(c.id);
    const lifeRow = lifeById.get(c.id);
    return { ...c, lifetimeSpend: lifeRow?.spend ?? c.lifetimeSpend };
  });
  for (const c of life) {
    if (seen.has(c.id)) continue;
    out.push({
      ...c,
      spend: 0,
      impressions: 0,
      clicks: 0,
      lpv: 0,
      leads: 0,
      ctr: 0,
      costPerResult: null,
      lifetimeSpend: c.spend,
      lane: classifyCampaign(c.status, c.platformStatus, 0),
    });
  }
  return out;
}

export function rollupAccount(
  spec: HqAdAccountSpec,
  campaigns: AdsCampaignRow[],
  window: AdsWindow,
  source: AdsSource,
  error?: string,
): AdsAccountBlock {
  return {
    key: spec.key,
    label: spec.label,
    adAccountId: spec.adAccountId,
    window,
    source,
    preferLpv: spec.preferLpv,
    spend: campaigns.reduce((s, c) => s + c.spend, 0),
    lifetimeSpend: campaigns.reduce((s, c) => s + c.lifetimeSpend, 0),
    lpv: campaigns.reduce((s, c) => s + c.lpv, 0),
    clicks: campaigns.reduce((s, c) => s + c.clicks, 0),
    leads: campaigns.reduce((s, c) => s + c.leads, 0),
    campaigns,
    ...(error ? { error } : {}),
  };
}

export function buildLanes(accounts: AdsAccountBlock[]): Record<AdsLane, string[]> {
  const lanes: Record<AdsLane, string[]> = { keep: [], fade: [], watch: [], dark: [] };
  for (const account of accounts) {
    if (account.source === "placeholder") continue;
    for (const row of account.campaigns) {
      lanes[row.lane].push(row.displayName);
    }
  }
  return lanes;
}

export function buildSnapshot(accounts: AdsAccountBlock[], now: Date = new Date()): AdsSnapshot {
  const live = accounts.some((a) => a.source === "live");
  return {
    asOf: now.toISOString(),
    timezone: HQ_ADS_TZ,
    day: indyDateKey(now),
    source: live ? "live" : "placeholder",
    accounts,
    lanes: buildLanes(accounts),
  };
}

export function placeholderAccount(spec: HqAdAccountSpec, error?: string): AdsAccountBlock {
  return rollupAccount(spec, [], "today", "placeholder", error ?? "awaiting ads API");
}

export function placeholderSnapshot(now: Date = new Date(), error?: string): AdsSnapshot {
  return buildSnapshot(
    HQ_AD_ACCOUNTS.map((spec) => placeholderAccount(spec, error)),
    now,
  );
}

export function isAdsSnapshot(value: unknown): value is AdsSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as AdsSnapshot;
  return (
    typeof v.asOf === "string" &&
    v.timezone === HQ_ADS_TZ &&
    typeof v.day === "string" &&
    (v.source === "live" || v.source === "placeholder") &&
    Array.isArray(v.accounts) &&
    !!v.lanes &&
    Array.isArray(v.lanes.keep)
  );
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseZernioCampaigns(body: unknown): ZernioCampaign[] {
  if (!body || typeof body !== "object") return [];
  const campaigns = (body as { campaigns?: unknown }).campaigns;
  if (!Array.isArray(campaigns)) return [];
  return campaigns.filter((c) => c && typeof c === "object") as ZernioCampaign[];
}

export function snapshotIsFresh(snapshot: AdsSnapshot, now: Date = new Date(), maxAgeMs = 6 * 3600_000): boolean {
  if (snapshot.source !== "live") return false;
  if (snapshot.day !== indyDateKey(now)) return false;
  const age = now.getTime() - Date.parse(snapshot.asOf);
  return Number.isFinite(age) && age >= 0 && age < maxAgeMs;
}

export function headerMetric(account: AdsAccountBlock, preferLpv: boolean): { kind: "LPV" | "clk"; value: number } {
  if (preferLpv && account.lpv > 0) return { kind: "LPV", value: account.lpv };
  if (preferLpv && account.campaigns.some((c) => c.lpv > 0 || c.spend > 0)) {
    return { kind: "LPV", value: account.lpv };
  }
  return { kind: "clk", value: account.clicks };
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatCtr(n: number): string {
  if (!n) return "—";
  return `${n.toFixed(n >= 10 ? 1 : 2)}%`;
}

export function formatCost(n: number | null): string {
  return n == null ? "—" : formatUsd(n);
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function mutedRow(lane: AdsLane): boolean {
  return lane === "fade" || lane === "dark";
}

export function ctrSignal(ctr: number, lane: AdsLane): AdsSignal {
  if (mutedRow(lane)) return "muted";
  if (!ctr) return lane === "keep" ? "watch" : "muted";
  if (ctr >= 3) return "good";
  if (ctr >= 1) return "soft";
  return "watch";
}

export function costSignal(cost: number | null, preferLpv: boolean, lane: AdsLane): AdsSignal {
  if (mutedRow(lane) || cost == null) return "muted";
  if (preferLpv) {
    if (cost <= 0.2) return "good";
    if (cost <= 0.5) return "soft";
    return "watch";
  }
  if (cost <= 0.1) return "good";
  if (cost <= 0.3) return "soft";
  return "watch";
}

export function leadsSignal(leads: number, lane: AdsLane): AdsSignal {
  if (mutedRow(lane)) return "muted";
  if (leads === 0 && (lane === "keep" || lane === "watch")) return "watch";
  if (leads === 0) return "muted";
  return "good";
}

export function daySpendSignal(spend: number, lane: AdsLane): AdsSignal {
  if (mutedRow(lane)) return "muted";
  if (lane === "keep" && spend > 0) return "good";
  if (lane === "watch") return "watch";
  return "neutral";
}

function judgment(signal: AdsSignal): string {
  if (signal === "good") return "good";
  if (signal === "soft") return "soft";
  if (signal === "watch") return "watch";
  if (signal === "muted") return "muted — fade / off";
  return "neutral";
}

export function laneTooltip(lane: AdsLane): string {
  switch (lane) {
    case "keep":
      return "Keep: live spender worth leaving on. Green.";
    case "fade":
      return "Fade: paused on purpose, winding down. $0 today is expected — muted amber.";
    case "watch":
      return "Watch: live but not spending, or a metric that needs a look. 0 leads on a traffic ad is watch, not a bug. Orange.";
    case "dark":
      return "Dark: off — archived, cancelled, or dead. Muted gray.";
  }
}

export function windowTooltip(window: AdsWindow): string {
  if (window === "yesterday") {
    return "Yesterday: last full day in America/Indiana/Indianapolis. Shown because today was empty. X Ads Manager is source of truth if Zernio lags.";
  }
  return "Today: spend so far in America/Indiana/Indianapolis.";
}

export function allTimeTooltip(): string {
  return "All-time: campaign lifetime spend (every day Zernio can read, up to 730). Not today's window.";
}

export function headerMetricTooltip(
  kind: "LPV" | "clk",
  value: number,
  leads: number,
  laneHint: AdsLane,
): string {
  if (kind === "LPV") {
    const signal = value > 0 ? "good" : mutedRow(laneHint) ? "muted" : "watch";
    return `LPV: landing page views in the daily window. ${formatInt(value)} LPV — ${judgment(signal)}. Cheap LPV is the goal on Jelly Studio traffic ads.`;
  }
  const signal = value > 0 ? (value >= 20 ? "good" : "soft") : mutedRow(laneHint) ? "muted" : "watch";
  return `Clk: link clicks in the daily window. ${formatInt(value)} clicks — ${judgment(signal)}.`;
}

export function leadsTooltip(leads: number, lane: AdsLane): string {
  const signal = leadsSignal(leads, lane);
  return `Leads in the daily window. ${formatInt(leads)} leads — ${judgment(signal)}. 0 leads is a real number, not a formatting bug; on a live traffic spender it is watch, not green.`;
}

export function colTooltip(
  col: "day$" | "life$" | "imp" | "clk" | "lpv" | "cpr" | "ctr",
  row: AdsCampaignRow,
  preferLpv: boolean,
): string {
  const muted = mutedRow(row.lane);
  if (col === "day$") {
    const signal = daySpendSignal(row.spend, row.lane);
    return `Day $: spend in the daily window (today, or yesterday if today was empty). ${formatUsd(row.spend)} — ${judgment(signal)}.${muted ? " Paused $0 is fade." : ""}`;
  }
  if (col === "life$") {
    return `Life $: all-time / campaign lifetime spend. ${formatUsd(row.lifetimeSpend)}. Not the daily window.`;
  }
  if (col === "imp") {
    return `Imp: impressions — times the ad was shown in the daily window. ${formatInt(row.impressions)}${muted ? " — muted, paused $0 is fade." : "."}`;
  }
  if (col === "clk") {
    return `Clk: link clicks in the daily window. ${formatInt(row.clicks)}${muted ? " — muted, paused $0 is fade." : "."}`;
  }
  if (col === "lpv") {
    const signal = row.lpv > 0 && !muted ? "good" : muted ? "muted" : row.lane === "keep" ? "watch" : "muted";
    return `LPV: landing page views in the daily window. ${formatInt(row.lpv)} — ${judgment(signal)}. Cheap LPV is good on Jelly Studio traffic ads.`;
  }
  if (col === "cpr") {
    const signal = costSignal(row.costPerResult, preferLpv, row.lane);
    const unit = preferLpv ? "LPV" : "click";
    return `$/result: cost per ${unit} in the daily window. ${formatCost(row.costPerResult)} — ${judgment(signal)}. Cheap $/LPV is good.`;
  }
  const signal = ctrSignal(row.ctr, row.lane);
  return `CTR: click-through rate in the daily window. ${formatCtr(row.ctr)} — ${judgment(signal)}. High CTR is good on these traffic ads.`;
}

export function headerColTitle(col: "day$" | "life$" | "imp" | "clk" | "lpv" | "cpr" | "ctr"): string {
  switch (col) {
    case "day$":
      return "Day $: spend today, or yesterday if today was empty. Green when a live ad is spending.";
    case "life$":
      return "Life $: all-time / campaign lifetime spend. Not the daily window.";
    case "imp":
      return "Imp: impressions — times the ad was shown in the daily window.";
    case "clk":
      return "Clk: link clicks in the daily window.";
    case "lpv":
      return "LPV: landing page views in the daily window. Cheap LPV is good on Jelly Studio traffic ads.";
    case "cpr":
      return "$/result: cost per LPV (or click if no LPV) in the daily window. Cheap is good.";
    case "ctr":
      return "CTR: click-through rate in the daily window. High is good on these traffic ads.";
  }
}

/** Narrow a persisted JSON blob; never throws. */
export function snapshotFromJson(value: unknown): AdsSnapshot | null {
  if (!isAdsSnapshot(value)) return null;
  return {
    asOf: value.asOf,
    timezone: HQ_ADS_TZ,
    day: value.day,
    source: value.source,
    accounts: value.accounts.map((a) => ({
      ...a,
      preferLpv: a.preferLpv === true || a.key === JELLY_META.key,
      spend: num(a.spend),
      lifetimeSpend: num(a.lifetimeSpend),
      lpv: num(a.lpv),
      clicks: num(a.clicks),
      leads: num(a.leads),
      campaigns: (a.campaigns ?? []).map((c) => ({
        ...c,
        spend: num(c.spend),
        lifetimeSpend: num(c.lifetimeSpend),
        impressions: num(c.impressions),
        clicks: num(c.clicks),
        lpv: num(c.lpv),
        leads: num(c.leads),
        ctr: num(c.ctr),
        costPerResult: c.costPerResult == null ? null : num(c.costPerResult),
      })),
    })),
    lanes: {
      keep: value.lanes.keep ?? [],
      fade: value.lanes.fade ?? [],
      watch: value.lanes.watch ?? [],
      dark: value.lanes.dark ?? [],
    },
  };
}
