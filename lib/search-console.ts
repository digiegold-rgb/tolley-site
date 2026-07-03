/**
 * Google Search Console — query helper.
 *
 * Reuses GA4_SERVICE_ACCOUNT_KEY (same service account, must also be added
 * as a user on the Search Console property). No new SDK needed — Search
 * Console API is a thin REST endpoint, signed with google-auth-library
 * (already a transitive dep via @google-analytics/data).
 */
import { GoogleAuth } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL ?? "sc-domain:tolley.io";
const API_BASE = "https://www.googleapis.com/webmasters/v3";

let authClient: GoogleAuth | null = null;

function getAuth(): GoogleAuth | null {
  if (authClient) return authClient;
  const keyJson = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  try {
    const credentials = JSON.parse(keyJson);
    authClient = new GoogleAuth({ credentials, scopes: [SCOPE] });
    return authClient;
  } catch {
    return null;
  }
}

async function fetchToken(): Promise<string | null> {
  const a = getAuth();
  if (!a) return null;
  const client = await a.getClient();
  const t = await client.getAccessToken();
  return t.token ?? null;
}

interface QueryRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function gscQuery(
  token: string,
  body: Record<string, unknown>,
): Promise<QueryRow[]> {
  const url = `${API_BASE}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { rows?: QueryRow[] };
  return json.rows ?? [];
}

export interface SearchConsoleSummary {
  configured: boolean;
  siteUrl: string;
  range: { start: string; end: string };
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  byCountry: { country: string; clicks: number; impressions: number }[];
  byDevice: { device: string; clicks: number; impressions: number }[];
  daily: { date: string; clicks: number; impressions: number }[];
  error?: string;
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function fetchSearchConsoleSummary(
  days = 28,
): Promise<SearchConsoleSummary> {
  const empty: SearchConsoleSummary = {
    configured: false,
    siteUrl: SITE_URL,
    range: { start: dateNDaysAgo(days), end: dateNDaysAgo(0) },
    totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    topQueries: [],
    topPages: [],
    byCountry: [],
    byDevice: [],
    daily: [],
  };

  const token = await fetchToken();
  if (!token) return empty;

  const startDate = dateNDaysAgo(days);
  const endDate = dateNDaysAgo(0);
  const baseRange = { startDate, endDate };

  try {
    const [totalsRows, queryRows, pageRows, countryRows, deviceRows, dailyRows] =
      await Promise.all([
        gscQuery(token, { ...baseRange, dimensions: [], rowLimit: 1 }),
        gscQuery(token, { ...baseRange, dimensions: ["query"], rowLimit: 25 }),
        gscQuery(token, { ...baseRange, dimensions: ["page"], rowLimit: 25 }),
        gscQuery(token, { ...baseRange, dimensions: ["country"], rowLimit: 10 }),
        gscQuery(token, { ...baseRange, dimensions: ["device"], rowLimit: 5 }),
        gscQuery(token, { ...baseRange, dimensions: ["date"], rowLimit: days + 5 }),
      ]);

    const t = totalsRows[0];
    return {
      configured: true,
      siteUrl: SITE_URL,
      range: { start: startDate, end: endDate },
      totals: t
        ? {
            clicks: t.clicks ?? 0,
            impressions: t.impressions ?? 0,
            ctr: t.ctr ?? 0,
            position: t.position ?? 0,
          }
        : empty.totals,
      topQueries: queryRows.map((r) => ({
        query: r.keys?.[0] ?? "(unknown)",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      })),
      topPages: pageRows.map((r) => ({
        page: r.keys?.[0] ?? "(unknown)",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      })),
      byCountry: countryRows.map((r) => ({
        country: r.keys?.[0] ?? "?",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
      })),
      byDevice: deviceRows.map((r) => ({
        device: r.keys?.[0] ?? "?",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
      })),
      daily: dailyRows
        .map((r) => ({
          date: r.keys?.[0] ?? "",
          clicks: r.clicks ?? 0,
          impressions: r.impressions ?? 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (err) {
    return { ...empty, configured: true, error: String(err) };
  }
}

export function searchConsoleServiceAccountEmail(): string | null {
  const keyJson = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  try {
    const j = JSON.parse(keyJson);
    return j.client_email ?? null;
  } catch {
    return null;
  }
}
