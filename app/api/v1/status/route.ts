/**
 * GET /api/v1/status — public API: is the renderer up, and how deep is the line?
 *
 * Auth: `Authorization: Bearer jly_live_…`. Keyed rather than open because the
 * queue depth is operational detail about our GPU fleet, not a public metric.
 *
 * 200: { ok, queue: { running, pending, depth }, checkedAt }
 *
 * `ok` is false when the DGX is unreachable — that is the answer, not an
 * error, so this endpoint returns 200 with ok:false rather than 502. An agent
 * deciding "should I submit work right now" needs a reply it can branch on;
 * making it handle both a status code and a body doubles its failure modes.
 *
 * Queue numbers come straight from the DGX's GET /vater/queue. The DGX is
 * called directly here rather than through lib/vater/autopilot-client because
 * that module has no queue method and belongs to another lane this cycle —
 * one small fetch is cheaper than a shared-file conflict.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/lib/vater/direct-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Status checks per key per minute. */
const LIMIT = 60;
const WINDOW_SEC = 60;
/** The DGX rides a Cloudflare tunnel; a health probe must not hang on it. */
const TIMEOUT_MS = 5000;

interface DgxQueue {
  running?: number;
  pending?: number;
  queued?: number;
  jobs?: unknown[];
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.response;

  const rl = await consumeRateLimit(`v1:status:${auth.keyId}`, LIMIT, WINDOW_SEC);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `This key may check status ${LIMIT} times per minute.`,
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  const base = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
  const key = process.env.CONTENT_API_KEY || "";
  if (!base || !key) {
    return NextResponse.json(
      {
        ok: false,
        queue: null,
        message: "Renderer is not configured on this deployment.",
        checkedAt: new Date().toISOString(),
      },
      { headers: NO_STORE },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/vater/queue`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          queue: null,
          message: `Renderer replied ${res.status}.`,
          checkedAt: new Date().toISOString(),
        },
        { headers: NO_STORE },
      );
    }
    const data = (await res.json()) as DgxQueue;
    const running = Number(data.running ?? 0);
    const pending = Number(data.pending ?? data.queued ?? 0);
    return NextResponse.json(
      {
        ok: true,
        queue: { running, pending, depth: running + pending },
        checkedAt: new Date().toISOString(),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.warn("[v1/status] queue read failed", err);
    return NextResponse.json(
      {
        ok: false,
        queue: null,
        message: "Renderer is unreachable right now.",
        checkedAt: new Date().toISOString(),
      },
      { headers: NO_STORE },
    );
  } finally {
    clearTimeout(timer);
  }
}
