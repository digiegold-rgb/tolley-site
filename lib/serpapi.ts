import { prisma } from "@/lib/prisma";

const SERPAPI_BASE = "https://serpapi.com/search.json";

export type SerpapiEngine =
  | "google"
  | "google_news"
  | "google_maps"
  | "google_shopping"
  | "google_images"
  | "google_lens"
  | "google_trends"
  | "google_finance"
  | "google_jobs"
  | "google_local"
  | "amazon"
  | "ebay"
  | "walmart"
  | "home_depot"
  | "lowes"
  | "yelp"
  | "youtube"
  | "bing"
  | "duckduckgo";

export interface SerpapiCallOptions {
  engine: SerpapiEngine;
  integration: string;
  params: Record<string, string>;
  timeoutMs?: number;
  costUnits?: number;
  /** Skip the monthly per-integration budget cap (use only for manual admin "Run now" buttons). */
  ignoreBudget?: boolean;
}

export interface SerpapiCallResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  rateLimited: boolean;
  outOfQuota: boolean;
  /** True when the call was blocked locally by the monthly per-integration cap. */
  budgetBlocked?: boolean;
}

// ── Monthly per-integration budget caps ─────────────────────────────────────
//
// The account is Starter: 1,000 successful searches/month, resetting on the
// 5th. Twice in a row we hit that ceiling before month end, and both times the
// cause was the same: an uncapped DAILY monitor quietly ate a quarter of the
// budget while the revenue integrations got nothing. In the 2026-07 cycle
// ai-overview-check alone burned 260 calls to record zero citations (751
// checks all-time, 0 ever cited) while dossier-people-search — the integration
// that actually produces seller leads — made 0 calls.
//
// So: every integration declares a ceiling here, and serpapiCall() refuses to
// spend past it. A monitor can no longer starve a money-maker.
//
// The caps below sum to 962. That is deliberate and load-bearing: if the sum
// exceeded the 1,000/month plan limit, a greedy integration could still drain
// the account before a quieter one ever ran, which is exactly the failure this
// table exists to prevent. Keep the sum under 1,000 when editing — the
// remaining ~38 is headroom for ad-hoc admin lookups.
//
// Unlisted integrations get DEFAULT_CAP so a new caller can't silently
// bypass the budget by not registering itself.
export const MONTHLY_CAPS: Record<string, number> = {
  // Revenue: finds property owners → seller leads. The priority claim.
  "dossier-people-search": 300,
  // Revenue: Amazon affiliate links on /shop + Treasure Haul products.
  "asin-backfill": 120,
  "asin-backfill-lens": 15,
  "shop-bulk-ingest": 60,
  // Revenue: owner names for KC-metro counties we cannot scrape (Jackson).
  "county-assessor-owner": 90,
  // Lead engines: real output, keep funded.
  "probate-scan": 90,
  "probate-enrich": 50,
  "probate-address": 40,
  "distress-scan": 30,
  "deal-scanner": 30,
  "deal-scanner-enrich": 30,
  "deal-scanner-comp": 20,
  "shop-intelligence": 15,
  // Monitors: throttled to monthly. These report a constant value; checking
  // them daily buys nothing but bill. Each cap leaves room for one manual
  // re-run above the scheduled cost (12 and 24 respectively).
  "ai-overview-check": 24,
  "maps-pack-track": 28,
  // Enough to re-harvest all 24 seeds once after the `num` param fix. Every
  // prior run returned 200 with an empty PAA block, so these pages have never
  // had content — this budget is for the retry.
  "neighborhood-gen": 20,
};

const DEFAULT_CAP = 25;

export function monthlyCapFor(integration: string): number {
  return MONTHLY_CAPS[integration] ?? DEFAULT_CAP;
}

/**
 * Start of the current SerpAPI billing cycle.
 *
 * SerpAPI resets on the plan renewal day (the 5th), NOT the 1st of the
 * calendar month. Counting from the 1st would under-count for the first
 * days of a cycle and let integrations overspend right after reset.
 */
export function billingCycleStart(now = new Date()): Date {
  const RENEWAL_DAY = 5;
  const d = new Date(now);
  if (d.getUTCDate() >= RENEWAL_DAY) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), RENEWAL_DAY));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, RENEWAL_DAY));
}

/** Successful (billed) calls this cycle for one integration. */
export async function cycleUsage(integration: string): Promise<number> {
  return prisma.serpapiQuery.count({
    where: {
      integration,
      success: true,
      createdAt: { gte: billingCycleStart() },
    },
  });
}

/** Per-integration usage vs cap for the current cycle — powers the admin view. */
export async function budgetReport(): Promise<
  { integration: string; used: number; cap: number; pct: number }[]
> {
  const since = billingCycleStart();
  const rows = await prisma.serpapiQuery.groupBy({
    by: ["integration"],
    where: { success: true, createdAt: { gte: since } },
    _count: { _all: true },
  });
  const used = new Map(rows.map((r) => [r.integration, r._count._all]));
  const names = new Set([...Object.keys(MONTHLY_CAPS), ...used.keys()]);
  return Array.from(names)
    .map((integration) => {
      const u = used.get(integration) ?? 0;
      const cap = monthlyCapFor(integration);
      return { integration, used: u, cap, pct: cap > 0 ? Math.round((u / cap) * 100) : 0 };
    })
    .sort((a, b) => b.pct - a.pct);
}

function isOutOfQuotaError(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const err = (body as { error?: unknown }).error;
  return typeof err === "string" && /run out of searches/i.test(err);
}

export function serpapiKey(): string | null {
  const key = process.env.SERPAPI_KEY;
  return key && key.trim() ? key.trim() : null;
}

export async function serpapiCall<T = unknown>(
  opts: SerpapiCallOptions
): Promise<SerpapiCallResult<T>> {
  const key = serpapiKey();
  if (!key) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "SERPAPI_KEY missing",
      rateLimited: false,
      outOfQuota: false,
    };
  }

  // Budget gate — refuse to spend past this integration's monthly ceiling.
  // Checked BEFORE the network call so a runaway monitor costs nothing. The
  // count query is cheap and indexed on (integration, createdAt).
  if (!opts.ignoreBudget) {
    const cap = monthlyCapFor(opts.integration);
    try {
      const used = await cycleUsage(opts.integration);
      if (used >= cap) {
        console.warn("[serpapi] monthly cap reached — call skipped", {
          integration: opts.integration,
          used,
          cap,
        });
        return {
          ok: false,
          status: 0,
          data: null,
          error: `Monthly SerpAPI budget reached for "${opts.integration}" (${used}/${cap})`,
          rateLimited: false,
          outOfQuota: false,
          budgetBlocked: true,
        };
      }
    } catch (err) {
      // If the budget check itself fails we let the call through rather than
      // hard-blocking every integration on a transient DB hiccup — the account
      // ceiling is still the ultimate backstop.
      console.error("[serpapi] budget check failed, allowing call", {
        integration: opts.integration,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const url = new URL(SERPAPI_BASE);
  url.searchParams.set("engine", opts.engine);
  for (const [k, v] of Object.entries(opts.params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  url.searchParams.set("api_key", key);

  const queryForLog = opts.params.q ?? opts.params.k ?? "";
  const timeoutMs = opts.timeoutMs ?? 12000;

  let result: SerpapiCallResult<T>;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON response, leave json null
    }

    if (!res.ok) {
      const outOfQuota = res.status === 429 || isOutOfQuotaError(json);
      result = {
        ok: false,
        status: res.status,
        data: null,
        error: text.slice(0, 300),
        rateLimited: res.status === 429,
        outOfQuota,
      };
    } else {
      result = {
        ok: true,
        status: res.status,
        data: json as T,
        error: null,
        rateLimited: false,
        outOfQuota: false,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = {
      ok: false,
      status: 0,
      data: null,
      error: message.slice(0, 300),
      rateLimited: false,
      outOfQuota: false,
    };
  }

  // Telemetry — AWAIT the write so every call is counted. A fire-and-forget
  // insert is dropped when the serverless function freezes/terminates right
  // after the caller returns (esp. inside `after()` cron bursts), which
  // undercounted usage badly vs the SerpAPI account. The insert is cheap
  // relative to the SerpAPI round-trip we just made, so awaiting adds
  // negligible latency. A telemetry failure must still never bubble up to the
  // caller — but we log it rather than swallow silently.
  try {
    await prisma.serpapiQuery.create({
      data: {
        integration: opts.integration,
        engine: opts.engine,
        query: queryForLog.slice(0, 500),
        success: result.ok,
        costUnits: opts.costUnits ?? 1,
        status: result.status || null,
        error: result.error,
      },
    });
  } catch (err) {
    console.error("[serpapi] telemetry write failed", {
      integration: opts.integration,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
