import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  DEFAULT_TV_STATS_URL,
  parseTvStats,
  summarizeStorage,
  type TvStatsSnapshot,
} from "@/lib/tv-stats";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/tv/stats — shop-admin proxy to the DGX read-only Arr snapshot.
 *
 * Host: TV_STATS_URL (default https://tv-stats.tolley.io)
 * Auth: x-api-key = TV_API_KEY (same secret as the DVR catch-all).
 * Separate hostname from Overseerr and from Spark DVR. Does not add Arr keys.
 */

const TV_STATS_URL = process.env.TV_STATS_URL || DEFAULT_TV_STATS_URL;

function disconnected(error: string, status = 200) {
  return NextResponse.json(
    {
      connected: false,
      ok: false,
      host: "tv-stats.tolley.io",
      error,
      nas: { wired: false },
      snapshot: null,
      storage: null,
    },
    { status },
  );
}

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.TV_API_KEY;
  if (!key) {
    return disconnected("TV_API_KEY not configured");
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${TV_STATS_URL}/api/status`, {
      headers: { "x-api-key": key },
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await r.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!r.ok || !data) {
      return disconnected(r.ok ? "tv-stats returned empty status" : `tv-stats HTTP ${r.status}`);
    }
    const snapshot: TvStatsSnapshot = parseTvStats(data);
    const storage = summarizeStorage(snapshot);
    return NextResponse.json({
      connected: true,
      ok: snapshot.ok,
      host: "tv-stats.tolley.io",
      ts: snapshot.ts,
      errors: snapshot.errors,
      nas: { wired: false },
      snapshot,
      storage,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return disconnected(msg.includes("abort") ? "tv-stats timeout" : "tv-stats unreachable");
  } finally {
    clearTimeout(t);
  }
}
