/**
 * Facebook Marketing API client — REST-based, no SDK dependency.
 * Uses long-lived user token with ads_management + ads_read permissions.
 */

const USER_TOKEN = process.env.FACEBOOK_USER_TOKEN || "";
const AD_ACCOUNT_ID = process.env.FACEBOOK_AD_ACCOUNT_ID || "act_1452652738964455";
const API_VERSION = process.env.FACEBOOK_API_VERSION || "v18.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

async function fbGet<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", USER_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`FB API ${path}: ${JSON.stringify(err.error || err)}`);
  }
  return resp.json() as Promise<T>;
}

async function fbPost<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: USER_TOKEN }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(`FB API POST ${path}: ${JSON.stringify(err.error || err)}`);
  }
  return resp.json() as Promise<T>;
}

// ─── Types ───

export interface FBCampaign {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  dailyBudget: number;
  budgetRemaining: number;
  startTime: string;
  stopTime?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
}

export interface FBAdSet {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  dailyBudget: number;
  targeting: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

export interface FBDailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
}

export interface FBAccountOverview {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
  reach: number;
  frequency: number;
}

// ─── Helpers ───

function extractLeads(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const lead = actions.find((a) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped");
  return lead ? parseInt(lead.value, 10) : 0;
}

function datePreset(days: number): string {
  if (days <= 7) return "last_7d";
  if (days <= 14) return "last_14d";
  if (days <= 30) return "last_30d";
  if (days <= 90) return "last_90d";
  return "maximum";
}

// ─── Public API ───

export async function getAccountOverview(days = 30): Promise<FBAccountOverview | null> {
  const data = await fbGet<{ data: Array<Record<string, string>> }>(`/${AD_ACCOUNT_ID}/insights`, {
    fields: "impressions,clicks,spend,actions,ctr,cpc,reach,frequency",
    date_preset: datePreset(days),
  });

  if (!data.data || data.data.length === 0) return null;
  const row = data.data[0] as Record<string, unknown>;
  return {
    impressions: parseInt(row.impressions as string, 10) || 0,
    clicks: parseInt(row.clicks as string, 10) || 0,
    spend: parseFloat(row.spend as string) || 0,
    leads: extractLeads(row.actions as Array<{ action_type: string; value: string }>),
    ctr: parseFloat(row.ctr as string) || 0,
    cpc: parseFloat(row.cpc as string) || 0,
    reach: parseInt(row.reach as string, 10) || 0,
    frequency: parseFloat(row.frequency as string) || 0,
  };
}

export async function listCampaigns(days = 30): Promise<FBCampaign[]> {
  // Get campaign list
  const campaigns = await fbGet<{ data: Array<Record<string, string>> }>(`/${AD_ACCOUNT_ID}/campaigns`, {
    fields: "id,name,status,effective_status,objective,daily_budget,budget_remaining,start_time,stop_time",
    limit: "25",
  });

  // Get insights per campaign
  const insights = await fbGet<{ data: Array<Record<string, unknown>> }>(`/${AD_ACCOUNT_ID}/insights`, {
    fields: "campaign_id,campaign_name,impressions,clicks,spend,actions,ctr,cpc",
    level: "campaign",
    date_preset: datePreset(days),
    limit: "25",
  });

  const insightMap = new Map<string, Record<string, unknown>>();
  for (const row of insights.data || []) {
    insightMap.set(row.campaign_id as string, row);
  }

  return (campaigns.data || []).map((c) => {
    const ins = insightMap.get(c.id) || {};
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      effectiveStatus: c.effective_status,
      objective: c.objective,
      dailyBudget: parseInt(c.daily_budget || "0", 10) / 100,
      budgetRemaining: parseInt(c.budget_remaining || "0", 10) / 100,
      startTime: c.start_time,
      stopTime: c.stop_time || undefined,
      impressions: parseInt(ins.impressions as string, 10) || 0,
      clicks: parseInt(ins.clicks as string, 10) || 0,
      spend: parseFloat(ins.spend as string) || 0,
      leads: extractLeads(ins.actions as Array<{ action_type: string; value: string }>),
      ctr: parseFloat(ins.ctr as string) || 0,
      cpc: parseFloat(ins.cpc as string) || 0,
    };
  });
}

export async function getCampaignInsights(campaignId: string, days = 30): Promise<FBDailyMetric[]> {
  const data = await fbGet<{ data: Array<Record<string, unknown>> }>(`/${campaignId}/insights`, {
    fields: "impressions,clicks,spend,actions,ctr,cpc",
    time_increment: "1",
    date_preset: datePreset(days),
    limit: "90",
  });

  return (data.data || []).map((row) => ({
    date: row.date_start as string,
    impressions: parseInt(row.impressions as string, 10) || 0,
    clicks: parseInt(row.clicks as string, 10) || 0,
    spend: parseFloat(row.spend as string) || 0,
    leads: extractLeads(row.actions as Array<{ action_type: string; value: string }>),
    ctr: parseFloat(row.ctr as string) || 0,
    cpc: parseFloat(row.cpc as string) || 0,
  }));
}

export async function getDailyAccountMetrics(days = 30): Promise<FBDailyMetric[]> {
  const data = await fbGet<{ data: Array<Record<string, unknown>> }>(`/${AD_ACCOUNT_ID}/insights`, {
    fields: "impressions,clicks,spend,actions,ctr,cpc",
    time_increment: "1",
    date_preset: datePreset(days),
    limit: "90",
  });

  return (data.data || []).map((row) => ({
    date: row.date_start as string,
    impressions: parseInt(row.impressions as string, 10) || 0,
    clicks: parseInt(row.clicks as string, 10) || 0,
    spend: parseFloat(row.spend as string) || 0,
    leads: extractLeads(row.actions as Array<{ action_type: string; value: string }>),
    ctr: parseFloat(row.ctr as string) || 0,
    cpc: parseFloat(row.cpc as string) || 0,
  }));
}

export async function listAdSets(campaignId: string, days = 30): Promise<FBAdSet[]> {
  const adsets = await fbGet<{ data: Array<Record<string, unknown>> }>(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,targeting",
    limit: "25",
  });

  const insights = await fbGet<{ data: Array<Record<string, unknown>> }>(`/${campaignId}/insights`, {
    fields: "adset_id,adset_name,impressions,clicks,spend,actions",
    level: "adset",
    date_preset: datePreset(days),
    limit: "25",
  });

  const insightMap = new Map<string, Record<string, unknown>>();
  for (const row of insights.data || []) {
    insightMap.set(row.adset_id as string, row);
  }

  return (adsets.data || []).map((a) => {
    const ins = insightMap.get(a.id as string) || {};
    const targeting = a.targeting as Record<string, unknown> | undefined;
    let targetingSummary = "—";
    if (targeting) {
      const parts: string[] = [];
      if (targeting.geo_locations) {
        const geo = targeting.geo_locations as Record<string, unknown[]>;
        if (geo.cities) parts.push(`${geo.cities.length} cities`);
        if (geo.regions) parts.push(`${geo.regions.length} regions`);
      }
      if (targeting.age_min || targeting.age_max) {
        parts.push(`${targeting.age_min || "18"}-${targeting.age_max || "65+"}`);
      }
      targetingSummary = parts.join(", ") || "—";
    }
    return {
      id: a.id as string,
      name: a.name as string,
      status: a.status as string,
      campaignId,
      dailyBudget: parseInt(a.daily_budget as string || "0", 10) / 100,
      targeting: targetingSummary,
      impressions: parseInt(ins.impressions as string, 10) || 0,
      clicks: parseInt(ins.clicks as string, 10) || 0,
      spend: parseFloat(ins.spend as string) || 0,
      leads: extractLeads(ins.actions as Array<{ action_type: string; value: string }>),
    };
  });
}

export async function updateCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED") {
  return fbPost(`/${campaignId}`, { status });
}

export async function updateCampaignBudget(campaignId: string, dailyBudgetCents: number) {
  return fbPost(`/${campaignId}`, { daily_budget: dailyBudgetCents });
}

export async function getAccountBilling(): Promise<string | null> {
  try {
    const data = await fbGet<Record<string, unknown>>(`/${AD_ACCOUNT_ID}`, {
      fields: "funding_source_details,currency",
    });
    const details = data.funding_source_details as Record<string, unknown> | undefined;
    if (!details) return null;
    const type = (details.display_string as string) || (details.type as string) || null;
    return type;
  } catch {
    return null;
  }
}
