import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  plexFromSettings,
  toPipelineItem,
  volumesFromArr,
  type PipelineItem,
  type RawRequest,
} from "@/lib/tv-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.OVERSEERR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OVERSEERR_API_KEY not configured" }, { status: 500 });
  }

  const [
    countRes,
    processingRes,
    failedRes,
    unavailableRes,
    recentRes,
    radarrRes,
    sonarrRes,
    plexRes,
    statusRes,
  ] = await Promise.all([
    overseerrGet("/api/v1/request/count", key, 8000),
    overseerrGet("/api/v1/request?take=50&skip=0&sort=modified&filter=processing", key, 8000),
    overseerrGet("/api/v1/request?take=50&skip=0&sort=modified&filter=failed", key, 8000),
    overseerrGet("/api/v1/request?take=40&skip=0&sort=modified&filter=unavailable", key, 8000),
    overseerrGet("/api/v1/request?take=80&skip=0&sort=modified&filter=all", key, 8000),
    overseerrGet("/api/v1/settings/radarr", key, 8000),
    overseerrGet("/api/v1/settings/sonarr", key, 8000),
    overseerrGet("/api/v1/settings/plex", key, 8000),
    overseerrGet("/api/v1/status", key, 5000),
  ]);

  const overseerrOk = statusRes.ok || countRes.ok || recentRes.ok;
  if (!overseerrOk) {
    const status = countRes.status || statusRes.status || 502;
    return NextResponse.json(
      {
        error: "Overseerr unreachable",
        detail: status ? `Upstream ${status}` : "Upstream unavailable",
        storage: { connected: false, volumes: [] },
        plex: { connected: false, name: null },
      },
      { status: 502 },
    );
  }

  const merged = mergeRequests(
    requestRows(processingRes.data),
    requestRows(failedRes.data),
    requestRows(unavailableRes.data),
    requestRows(recentRes.data),
  );
  const hints = await fetchTitles(key, merged);

  const items: PipelineItem[] = merged.map((r) => {
    const mediaType: "movie" | "tv" = r.type === "tv" || r.media?.mediaType === "tv" ? "tv" : "movie";
    const tmdbId = Number(r.media?.tmdbId) || 0;
    return toPipelineItem(r, hints.get(`${mediaType}:${tmdbId}`));
  });

  const downloading = items.filter((i) => i.bucket === "downloading");
  const needsRetry = items.filter((i) => i.bucket === "needs_retry");
  const failed = items.filter((i) => i.bucket === "failed");
  const waiting = items.filter((i) => i.bucket === "waiting");

  const count =
    countRes.ok && countRes.data && typeof countRes.data === "object"
      ? (countRes.data as Record<string, number>)
      : {};

  const volumes = [
    ...volumesFromArr("radarr", radarrRes.ok ? radarrRes.data : null),
    ...volumesFromArr("sonarr", sonarrRes.ok ? sonarrRes.data : null),
  ];

  const statusData =
    statusRes.ok && statusRes.data && typeof statusRes.data === "object"
      ? (statusRes.data as { version?: string })
      : {};

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    overseerr: {
      ok: true,
      version: typeof statusData.version === "string" ? statusData.version : null,
    },
    plex: plexFromSettings(plexRes.ok ? plexRes.data : null),
    // Overseerr 1.35 has no disk-space GET (/api/v1/diskspace → 404). Volume
    // names come from GET /settings/radarr|sonarr activeDirectory only.
    storage: {
      connected: false,
      volumes,
    },
    counts: {
      total: Number(count.total) || items.length,
      movie: Number(count.movie) || 0,
      tv: Number(count.tv) || 0,
      pending: Number(count.pending) || waiting.length,
      processing: Number(count.processing) || downloading.length,
      available: Number(count.available) || 0,
      declined: Number(count.declined) || failed.length,
      failed: needsRetry.length,
      downloading: downloading.length,
      waiting: waiting.length,
      needsRetry: needsRetry.length,
      failedOrAired: failed.length,
      fourKDownloading: downloading.filter((i) => i.quality === "4k").length,
      fourKFailed: [...needsRetry, ...failed].filter((i) => i.quality === "4k").length,
      hdFailed: [...needsRetry, ...failed].filter((i) => i.quality === "hd").length,
    },
    downloading,
    needsRetry,
    failed,
    waiting,
  });
}
