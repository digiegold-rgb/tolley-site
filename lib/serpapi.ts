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
}

export interface SerpapiCallResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  rateLimited: boolean;
  outOfQuota: boolean;
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
