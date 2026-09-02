import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  DEFAULT_TV_STATS_URL,
  runTvStatsRetries,
  tvStatsRequest,
  tvStatsRetryCandidatesPath,
  tvStatsRetryPath,
} from "@/lib/tv-stats";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * POST /api/tv/stats/retry — shop-admin / cron proxy to Spark stalled retry.
 *
 * GET tv-stats /api/retry-candidates, drop importPending/importBlocked, then
 * POST /api/retry { ids }. Body `{}` retries all eligible candidates; `{ ids }`
 * intersects with that list. Never remount / gluetun / queue-delete.
 *
 * Host: TV_STATS_URL. Auth header: x-api-key = TV_API_KEY.
 * Gated by shop-admin session or Authorization: Bearer ${CRON_SECRET}.
 */

const TV_STATS_URL = process.env.TV_STATS_URL || DEFAULT_TV_STATS_URL;

async function authorized(req: NextRequest): Promise<boolean> {
  if (secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) {
    return true;
  }
  return validateShopAdmin();
}

function requestedIds(body: unknown): number[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids)) return undefined;
  const out = ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  return out.length ? out : undefined;
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.TV_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        connected: false,
        ok: false,
        host: "tv-stats.tolley.io",
        error: "TV_API_KEY not configured",
        nas: { wired: false },
        retried: [],
        skipped: [],
        posted: null,
      },
      { status: 200 },
    );
  }

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  try {
    const result = await runTvStatsRetries({
      requestedIds: requestedIds(body),
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
      postRetry: async (retryBody) => {
        const res = await tvStatsRequest(tvStatsRetryPath(), {
          key,
          baseUrl: TV_STATS_URL,
          method: "POST",
          body: retryBody,
          timeoutMs: 8000,
        });
        return {
          ok: res.ok,
          status: res.status,
          error: res.ok ? undefined : String((res.data as { error?: string })?.error || res.status),
        };
      },
    });
    return NextResponse.json({
      connected: true,
      ok: true,
      host: "tv-stats.tolley.io",
      nas: { wired: false },
      retried: result.retried,
      skipped: result.skipped,
      posted: result.posted,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        connected: false,
        ok: false,
        host: "tv-stats.tolley.io",
        error: msg.includes("abort") ? "tv-stats timeout" : msg,
        nas: { wired: false },
        retried: [],
        skipped: [],
        posted: null,
      },
      { status: 200 },
    );
  }
}
