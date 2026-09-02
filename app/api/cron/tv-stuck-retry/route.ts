import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import {
  overseerrRetryPath,
  toPipelineItem,
  type PipelineItem,
  type RawRequest,
} from "@/lib/tv-analytics";
import {
  loadRecentTvRetries,
  recordTvRetry,
  runStuckRetries,
} from "@/lib/tv-stuck-retry";
import {
  DEFAULT_TV_STATS_URL,
  runTvStatsRetries,
  tvStatsRequest,
  tvStatsRetryCandidatesPath,
  tvStatsRetryPath,
} from "@/lib/tv-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/cron/tv-stuck-retry
 *
 * 1) Overseerr POST /api/v1/request/{id}/retry for FAILED requests only.
 *    That endpoint re-approves and re-sends to Arr — it does not restart
 *    Transmission. Do not call it for processing/waiting.
 * 2) Stalled downloads: GET tv-stats /api/retry-candidates, then POST
 *    /api/retry { ids } after dropping importPending/importBlocked.
 *    Spark already enforces incomplete+stalled, skip imported, 24h cooldown.
 *
 * No Arr / Transmission keys. No vercel.json functions key.
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */

const OVERSEERR_URL = process.env.OVERSEERR_URL || "https://tv-api.tolley.io";
const TV_STATS_URL = process.env.TV_STATS_URL || DEFAULT_TV_STATS_URL;

function authorized(req: NextRequest): boolean {
  return secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`);
}

async function overseerr(
  method: "GET" | "POST",
  path: string,
  key: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${OVERSEERR_URL}${path}`, {
      method,
      headers: { "X-Api-Key": key },
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await r.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return { ok: r.ok, status: r.status, data };
  } catch (e: unknown) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : String(e) } };
  } finally {
    clearTimeout(t);
  }
}

function requestRows(data: unknown): RawRequest[] {
  if (!data || typeof data !== "object") return [];
  const results = (data as { results?: unknown }).results;
  return Array.isArray(results) ? (results as RawRequest[]) : [];
}

async function loadFailedRequests(key: string): Promise<PipelineItem[]> {
  const failedRes = await overseerr(
    "GET",
    "/api/v1/request?take=50&skip=0&sort=modified&filter=failed",
    key,
    8000,
  );
  const listed = requestRows(failedRes.data);
  const byId = new Map<number, RawRequest>();
  for (const r of listed) {
    const id = Number(r.id);
    if (id && !byId.has(id)) byId.set(id, r);
  }
  const rows = [...byId.values()].slice(0, 24);
  const fresh = new Map<number, RawRequest>();
  await Promise.all(
    rows.map(async (r) => {
      const res = await overseerr("GET", `/api/v1/request/${r.id}`, key, 4000);
      if (res.ok && res.data && typeof res.data === "object") {
        fresh.set(Number(r.id), res.data as RawRequest);
      }
    }),
  );
  return rows.map((r) => {
    const extra = fresh.get(Number(r.id));
    const merged = extra ? { ...r, ...extra, media: { ...(r.media || {}), ...(extra.media || {}) } } : r;
    return toPipelineItem(merged);
  });
}

async function retryStalled(key: string) {
  return runTvStatsRetries({
    getCandidates: async () => {
      const res = await tvStatsRequest(tvStatsRetryCandidatesPath(), {
        key,
        baseUrl: TV_STATS_URL,
        timeoutMs: 8000,
      });
      if (!res.ok) {
        throw new Error(
          String((res.data as { error?: string })?.error || `tv-stats candidates HTTP ${res.status}`),
        );
      }
      return res.data;
    },
    postRetry: async (body) => {
      const res = await tvStatsRequest(tvStatsRetryPath(), {
        key,
        baseUrl: TV_STATS_URL,
        method: "POST",
        body,
        timeoutMs: 8000,
      });
      return {
        ok: res.ok,
        status: res.status,
        error: res.ok ? undefined : String((res.data as { error?: string })?.error || res.status),
      };
    },
  });
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const overseerrKey = process.env.OVERSEERR_API_KEY;
  if (!overseerrKey) {
    return NextResponse.json({ error: "OVERSEERR_API_KEY not configured" }, { status: 500 });
  }

  const items = await loadFailedRequests(overseerrKey);
  const lastRetryAtById = await loadRecentTvRetries();
  const result = await runStuckRetries(items, {
    lastRetryAtById,
    retry: async (id) => {
      const res = await overseerr("POST", overseerrRetryPath(id), overseerrKey, 8000);
      return {
        ok: res.ok,
        status: res.status,
        error: res.ok ? undefined : String((res.data as { error?: string })?.error || res.status),
      };
    },
    recordRetry: recordTvRetry,
    log: (msg, extra) => console.log(`[tv-stuck-retry] ${msg}`, extra || ""),
  });

  const tvKey = process.env.TV_API_KEY;
  let stalled: {
    retried: number[];
    skipped: Array<{ id: number | null; name: string | null; reason: string }>;
    posted: { ids: number[] } | null;
    error?: string;
  };
  if (!tvKey) {
    stalled = { retried: [], skipped: [], posted: null, error: "TV_API_KEY not configured" };
  } else {
    try {
      stalled = await retryStalled(tvKey);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      console.log("[tv-stuck-retry] tv-stats retry skipped", { error });
      stalled = { retried: [], skipped: [], posted: null, error };
    }
  }

  return NextResponse.json({
    ok: true,
    nas: { wired: false },
    retried: result.retried,
    skipped: result.skipped,
    stalled,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
