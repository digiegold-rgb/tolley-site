import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  toPipelineItem,
  type PipelineItem,
  type RawRequest,
} from "@/lib/tv-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// NAS Overseerr only. Spark DVR is a different host and is not queried here.
const OVERSEERR_URL = process.env.OVERSEERR_URL || "https://tv-api.tolley.io";

type TitleHint = { title?: string; year?: string; posterPath?: string | null };

async function overseerrGet(
  path: string,
  key: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${OVERSEERR_URL}${path}`, {
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
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, data: { error: msg } };
  } finally {
    clearTimeout(t);
  }
}

function requestRows(data: unknown): RawRequest[] {
  if (!data || typeof data !== "object") return [];
  const results = (data as { results?: unknown }).results;
  return Array.isArray(results) ? (results as RawRequest[]) : [];
}

async function mapPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(n, Math.max(items.length, 0)) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function fetchTitles(
  key: string,
  items: RawRequest[],
): Promise<Map<string, TitleHint>> {
  const seen = new Map<string, { mediaType: "movie" | "tv"; tmdbId: number }>();
  for (const r of items) {
    const mediaType: "movie" | "tv" = r.type === "tv" || r.media?.mediaType === "tv" ? "tv" : "movie";
    const tmdbId = Number(r.media?.tmdbId) || 0;
    if (!tmdbId) continue;
    const k = `${mediaType}:${tmdbId}`;
    if (!seen.has(k)) seen.set(k, { mediaType, tmdbId });
  }
  const keys = [...seen.values()].slice(0, 36);
  const hints = new Map<string, TitleHint>();
  await mapPool(keys, 6, async ({ mediaType, tmdbId }) => {
    const path = mediaType === "tv" ? `/api/v1/tv/${tmdbId}` : `/api/v1/movie/${tmdbId}`;
    const res = await overseerrGet(path, key, 3500);
    if (!res.ok || !res.data || typeof res.data !== "object") return;
    const d = res.data as {
      title?: string;
      name?: string;
      releaseDate?: string;
      firstAirDate?: string;
      posterPath?: string;
    };
    hints.set(`${mediaType}:${tmdbId}`, {
      title: d.title || d.name,
      year: String(d.releaseDate || d.firstAirDate || "").slice(0, 4),
      posterPath: d.posterPath || null,
    });
  });
  return hints;
}

function mergeRequests(...lists: RawRequest[][]): RawRequest[] {
  const byId = new Map<number, RawRequest>();
  for (const list of lists) {
    for (const r of list) {
      const id = Number(r.id);
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, r);
    }
  }
  return [...byId.values()];
}

/** GET /request/{id} for media.status, externalServiceId, downloadStatus. */
async function hydrateRequests(key: string, rows: RawRequest[]): Promise<RawRequest[]> {
  const need = rows.filter((r) => Number(r.id) > 0).slice(0, 24);
  if (need.length === 0) return rows;
  const fresh = new Map<number, RawRequest>();
  await mapPool(need, 6, async (r) => {
    const res = await overseerrGet(`/api/v1/request/${r.id}`, key, 4000);
    if (!res.ok || !res.data || typeof res.data !== "object") return;
    fresh.set(Number(r.id), res.data as RawRequest);
  });
  return rows.map((r) => {
    const id = Number(r.id);
    const extra = fresh.get(id);
    if (!extra) return r;
    return {
      ...r,
      ...extra,
      media: { ...(r.media || {}), ...(extra.media || {}) },
    };
  });
}

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.OVERSEERR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OVERSEERR_API_KEY not configured" }, { status: 500 });
  }

  const [countRes, processingRes, failedRes, availableRes, statusRes] = await Promise.all([
    overseerrGet("/api/v1/request/count", key, 8000),
    overseerrGet("/api/v1/request?take=50&skip=0&sort=modified&filter=processing", key, 8000),
    overseerrGet("/api/v1/request?take=50&skip=0&sort=modified&filter=failed", key, 8000),
    overseerrGet("/api/v1/request?take=20&skip=0&sort=modified&filter=available", key, 8000),
    overseerrGet("/api/v1/status", key, 5000),
  ]);

  const overseerrOk = statusRes.ok || countRes.ok || processingRes.ok || failedRes.ok;
  if (!overseerrOk) {
    return NextResponse.json(
      {
        error: "Overseerr unreachable",
        detail: "NAS Overseerr at tv-api.tolley.io did not answer",
        nas: { wired: false },
      },
      { status: 502 },
    );
  }

  const listed = mergeRequests(
    requestRows(processingRes.data),
    requestRows(failedRes.data),
    requestRows(availableRes.data),
  );
  const merged = await hydrateRequests(key, listed);
  const hints = await fetchTitles(key, merged);

  const items: PipelineItem[] = merged.map((r) => {
    const mediaType: "movie" | "tv" = r.type === "tv" || r.media?.mediaType === "tv" ? "tv" : "movie";
    const tmdbId = Number(r.media?.tmdbId) || 0;
    return toPipelineItem(r, hints.get(`${mediaType}:${tmdbId}`));
  });

  const downloading = items
    .filter((i) => i.bucket === "downloading" || i.bucket === "waiting")
    .sort((a, b) => {
      if (a.motion === "stuck" && b.motion !== "stuck") return -1;
      if (b.motion === "stuck" && a.motion !== "stuck") return 1;
      return (b.ageMs ?? 0) - (a.ageMs ?? 0);
    });
  const needsRetry = items.filter((i) => i.bucket === "needs_retry");
  const failed = items.filter((i) => i.bucket === "failed");
  const available = items.filter((i) => i.bucket === "available");

  const count =
    countRes.ok && countRes.data && typeof countRes.data === "object"
      ? (countRes.data as Record<string, number>)
      : {};

  const statusData =
    statusRes.ok && statusRes.data && typeof statusRes.data === "object"
      ? (statusRes.data as { version?: string })
      : {};

  const processingStuck = downloading.filter((i) => i.motion === "stuck").length;
  const processingMoving = downloading.filter((i) => i.motion === "moving").length;

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    overseerr: {
      ok: true,
      version: typeof statusData.version === "string" ? statusData.version : null,
      host: "tv-api.tolley.io",
    },
    // Arr diskspace / Transmission RPC / Plex sessions live on the NAS.
    // Vercel does not hold those keys and must not grow new secrets.
    nas: {
      wired: false,
      moviesMount: "/mnt/plex-movies",
      tvMount: "/mnt/plex-tv",
      note: "queue/disk live on NAS — not wired to this tab",
    },
    counts: {
      total: Number(count.total) || items.length,
      movie: Number(count.movie) || 0,
      tv: Number(count.tv) || 0,
      pending: Number(count.pending) || 0,
      processing: Number(count.processing) || downloading.length,
      available: Number(count.available) || available.length,
      declined: Number(count.declined) || failed.length,
      failed: needsRetry.length,
      downloading: downloading.length,
      needsRetry: needsRetry.length,
      failedOrAired: failed.length,
      processingStuck,
      processingMoving,
      fourKDownloading: downloading.filter((i) => i.quality === "4k").length,
      fourKFailed: [...needsRetry, ...failed].filter((i) => i.quality === "4k").length,
      hdFailed: [...needsRetry, ...failed].filter((i) => i.quality === "hd").length,
    },
    downloading,
    needsRetry,
    failed,
    available,
  });
}
