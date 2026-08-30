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

export interface AdsCampaignRow {
  id: string;
  name: string;
  displayName: string;
  status: string;
  platformStatus: string;
  spend: number;
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
    impressions,
    clicks,
    lpv,
    leads,
    ctr: Number(raw.metrics?.ctr) || 0,
    costPerResult: costPerResult(spend, lpv, leads, clicks),
    lane: classifyCampaign(status, platformStatus, spend),
  };
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
      lpv: num(a.lpv),
      clicks: num(a.clicks),
      leads: num(a.leads),
      campaigns: (a.campaigns ?? []).map((c) => ({
        ...c,
        spend: num(c.spend),
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
