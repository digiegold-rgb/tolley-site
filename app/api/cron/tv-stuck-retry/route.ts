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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/cron/tv-stuck-retry
 *
 * After the 2h stuck clock, retry once via NAS Overseerr
 * POST /api/v1/request/{id}/retry. No Arr / Transmission keys.
 * No vercel.json functions key — same pattern as /api/cron/socials-collect.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */

const OVERSEERR_URL = process.env.OVERSEERR_URL || "https://tv-api.tolley.io";

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

async function loadPipeline(key: string): Promise<PipelineItem[]> {
  const processingRes = await overseerr(
    "GET",
    "/api/v1/request?take=50&skip=0&sort=modified&filter=processing",
    key,
    8000,
  );
  const listed = requestRows(processingRes.data);
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

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.OVERSEERR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OVERSEERR_API_KEY not configured" }, { status: 500 });
  }

  const items = await loadPipeline(key);
  const lastRetryAtById = await loadRecentTvRetries();
  const result = await runStuckRetries(items, {
    lastRetryAtById,
    retry: async (id) => {
      const res = await overseerr("POST", overseerrRetryPath(id), key, 8000);
      return {
        ok: res.ok,
        status: res.status,
        error: res.ok ? undefined : String((res.data as { error?: string })?.error || res.status),
      };
    },
    recordRetry: recordTvRetry,
    log: (msg, extra) => console.log(`[tv-stuck-retry] ${msg}`, extra || ""),
  });

  return NextResponse.json({
    ok: true,
    nas: { wired: false },
    retried: result.retried,
    skipped: result.skipped,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
