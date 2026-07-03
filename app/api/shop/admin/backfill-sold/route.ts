/**
 * Admin proxy for the FB sold-items backfill.
 *
 * The fb-draft-worker service runs at 127.0.0.1:8477 (or via Cloudflare
 * tunnel for production), gated by FB_DRAFT_SECRET. The browser can't reach
 * either of those directly, so this route proxies the start/poll calls.
 *
 *   POST /api/shop/admin/backfill-sold      — kick off a new backfill
 *   GET  /api/shop/admin/backfill-sold?id=X — poll progress
 *
 * Both gated behind validateShopAdmin().
 */

import { NextRequest, NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKER_URL =
  process.env.FB_DRAFT_WORKER_URL || "http://127.0.0.1:8477";
const WORKER_SECRET = process.env.FB_DRAFT_SECRET;

function authHeaders(): Record<string, string> {
  if (!WORKER_SECRET) return {};
  return { Authorization: `Bearer ${WORKER_SECRET}` };
}

export async function POST(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!WORKER_SECRET) {
    return NextResponse.json(
      { error: "FB_DRAFT_SECRET not set on server" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${WORKER_URL}/mirror/backfill-sold`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON: keep as text */
    }
    return NextResponse.json(body as object, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        error: "worker unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!WORKER_SECRET) {
    return NextResponse.json(
      { error: "FB_DRAFT_SECRET not set on server" },
      { status: 500 }
    );
  }
  const jobId = req.nextUrl.searchParams.get("id");
  if (!jobId) {
    return NextResponse.json(
      { error: "id query param required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${WORKER_URL}/mirror/backfill-sold/${encodeURIComponent(jobId)}`,
      {
        headers: { ...authHeaders() },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON: keep as text */
    }
    return NextResponse.json(body as object, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        error: "worker unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
