/**
 * Google Ads API client — REST-based, no heavy SDK dependency.
 * Uses gcloud's OAuth client with quota project header for tolley-io-489904.
 */

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || "d-FL95Q19q7MQmFpd7hHD0Ty";
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN || "";
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "8139646676";
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || "8139646676";
const QUOTA_PROJECT = "tolley-io-489904";
const API_VERSION = "v23";
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  const data = await resp.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "developer-token": DEVELOPER_TOKEN,
    "login-customer-id": LOGIN_CUSTOMER_ID,
    "x-goog-user-project": QUOTA_PROJECT,
    "Content-Type": "application/json",
  };
}

async function query(gaql: string, customerId?: string): Promise<unknown[]> {
  const token = await getAccessToken();
  const cid = customerId || CUSTOMER_ID;
  const resp = await fetch(`${BASE_URL}/customers/${cid}/googleAds:searchStream`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ query: gaql }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(JSON.stringify(err));
  }

  const results = await resp.json();
  // searchStream returns array of batches, each with results
  return results.flatMap((batch: { results?: unknown[] }) => batch.results || []);
}

async function mutate(resource: string, operations: unknown[], customerId?: string) {
  const token = await getAccessToken();
  const cid = customerId || CUSTOMER_ID;
  const resp = await fetch(`${BASE_URL}/customers/${cid}/${resource}:mutate`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ operations }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(JSON.stringify(err));
  }
  return resp.json();
}

// ─── Public API ───

export interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
  budget: number;
  budgetId: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  startDate?: string;
  endDate?: string;
}

export interface CampaignMetrics {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
}

export interface KeywordPerformance {
  keyword: string;
  matchType: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
  qualityScore?: number;
}

export interface AdPerformance {
  id: string;
  headlines: string[];
  descriptions: string[];
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
}

export async function listCampaigns(days = 30): Promise<Campaign[]> {
  const rows = await query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      campaign_budget.id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date DURING LAST_${days === 7 ? "7" : days === 90 ? "90" : "30"}_DAYS
    ORDER BY metrics.cost_micros DESC
  `);

  return rows.map((r: any) => ({
    id: r.campaign.id,
    name: r.campaign.name,
    status: r.campaign.status,
    type: r.campaign.advertisingChannelType,
    budget: (r.campaignBudget?.amountMicros || 0) / 1_000_000,
    budgetId: r.campaignBudget?.id || "",
    impressions: r.metrics.impressions || 0,
    clicks: r.metrics.clicks || 0,
    cost: (r.metrics.costMicros || 0) / 1_000_000,
    conversions: r.metrics.conversions || 0,
    ctr: r.metrics.ctr || 0,
    avgCpc: (r.metrics.averageCpc || 0) / 1_000_000,
    startDate: r.campaign.startDate,
    endDate: r.campaign.endDate,
  }));
}

export async function getCampaignMetrics(campaignId: string, days = 30): Promise<CampaignMetrics[]> {
  const rows = await query(`
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE campaign.id = ${campaignId}
      AND segments.date DURING LAST_${days === 7 ? "7" : days === 90 ? "90" : "30"}_DAYS
    ORDER BY segments.date ASC
  `);

  return rows.map((r: any) => ({
    date: r.segments.date,
    impressions: r.metrics.impressions || 0,
    clicks: r.metrics.clicks || 0,
    cost: (r.metrics.costMicros || 0) / 1_000_000,
    conversions: r.metrics.conversions || 0,
    ctr: r.metrics.ctr || 0,
    avgCpc: (r.metrics.averageCpc || 0) / 1_000_000,
  }));
}

export async function getKeywordPerformance(campaignId: string, days = 30): Promise<KeywordPerformance[]> {
  const rows = await query(`
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM keyword_view
    WHERE campaign.id = ${campaignId}
      AND segments.date DURING LAST_${days === 7 ? "7" : days === 90 ? "90" : "30"}_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 50
  `);

  return rows.map((r: any) => ({
    keyword: r.adGroupCriterion.keyword.text,
    matchType: r.adGroupCriterion.keyword.matchType,
    impressions: r.metrics.impressions || 0,
    clicks: r.metrics.clicks || 0,
    cost: (r.metrics.costMicros || 0) / 1_000_000,
    conversions: r.metrics.conversions || 0,
    ctr: r.metrics.ctr || 0,
    avgCpc: (r.metrics.averageCpc || 0) / 1_000_000,
    qualityScore: r.adGroupCriterion.qualityInfo?.qualityScore,
  }));
}

export async function getAdPerformance(campaignId: string, days = 30): Promise<AdPerformance[]> {
  const rows = await query(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr
    FROM ad_group_ad
    WHERE campaign.id = ${campaignId}
      AND ad_group_ad.ad.type = RESPONSIVE_SEARCH_AD
      AND segments.date DURING LAST_${days === 7 ? "7" : days === 90 ? "90" : "30"}_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 20
  `);

  return rows.map((r: any) => ({
    id: r.adGroupAd.ad.id,
    headlines: (r.adGroupAd.ad.responsiveSearchAd?.headlines || []).map((h: any) => h.text),
    descriptions: (r.adGroupAd.ad.responsiveSearchAd?.descriptions || []).map((d: any) => d.text),
    impressions: r.metrics.impressions || 0,
    clicks: r.metrics.clicks || 0,
    cost: (r.metrics.costMicros || 0) / 1_000_000,
    conversions: r.metrics.conversions || 0,
    ctr: r.metrics.ctr || 0,
  }));
}

export async function getAccountOverview(days = 30) {
  const rows = await query(`
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM customer
    WHERE segments.date DURING LAST_${days === 7 ? "7" : days === 90 ? "90" : "30"}_DAYS
  `);

  if (rows.length === 0) return null;
  const m = (rows[0] as any).metrics;
  return {
    impressions: m.impressions || 0,
    clicks: m.clicks || 0,
    cost: (m.costMicros || 0) / 1_000_000,
    conversions: m.conversions || 0,
    ctr: m.ctr || 0,
    avgCpc: (m.averageCpc || 0) / 1_000_000,
    costPerConversion: (m.costPerConversion || 0) / 1_000_000,
  };
}

export async function getDailyAccountMetrics(days = 30): Promise<CampaignMetrics[]> {
  const rows = await query(`
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM customer
    WHERE segments.date DURING LAST_${days === 7 ? "7" : days === 90 ? "90" : "30"}_DAYS
    ORDER BY segments.date ASC
  `);

  return rows.map((r: any) => ({
    date: r.segments.date,
    impressions: r.metrics.impressions || 0,
    clicks: r.metrics.clicks || 0,
    cost: (r.metrics.costMicros || 0) / 1_000_000,
    conversions: r.metrics.conversions || 0,
    ctr: r.metrics.ctr || 0,
    avgCpc: (r.metrics.averageCpc || 0) / 1_000_000,
  }));
}

export async function updateCampaignBudget(budgetId: string, newBudgetMicros: number) {
  return mutate("campaignBudgets", [{
    update: {
      resourceName: `customers/${CUSTOMER_ID}/campaignBudgets/${budgetId}`,
      amountMicros: String(newBudgetMicros),
    },
    updateMask: "amount_micros",
  }]);
}

export async function updateCampaignStatus(campaignId: string, status: "ENABLED" | "PAUSED") {
  return mutate("campaigns", [{
    update: {
      resourceName: `customers/${CUSTOMER_ID}/campaigns/${campaignId}`,
      status,
    },
    updateMask: "status",
  }]);
}
