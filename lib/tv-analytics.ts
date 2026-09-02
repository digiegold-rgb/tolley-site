/**
 * Read-only mapping for the Tolley TV Analytics tab.
 *
 * Live map (DGX-confirmed): Vercel /tv → NAS Overseerr (tv-api.tolley.io)
 * auto-approve → Radarr :7878 / Sonarr :8989 on 192.168.2.196 → Transmission
 * :9091 via gluetun → /mnt/plex-movies and /mnt/plex-tv → Plex :32400.
 *
 * Movies: profileId 4 = HD-1080p, profileId 5 = Ultra-HD on the same Radarr.
 * TV: seasons=all, no 4K path. Overseerr stays on tv-api.tolley.io. The optional
 * read-only snapshot is tv-stats.tolley.io (TV_API_KEY). This tab never talks
 * to tv-dvr / Arr / Transmission / Plex directly.
 */

export const HD_PROFILE_ID = 4;
export const UHD_PROFILE_ID = 5;

/** MediaRequestStatus in Overseerr. */
export const RequestStatus = {
  PENDING: 1,
  APPROVED: 2,
  DECLINED: 3,
  FAILED: 4,
  COMPLETED: 5,
} as const;

/** MediaStatus in Overseerr. */
export const MediaStatus = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
  DELETED: 6,
} as const;

export type Quality = "4k" | "hd";

export type PipelineBucket =
  | "downloading"
  | "needs_retry"
  | "failed"
  | "waiting"
  | "available";

/** Actively transferring vs sitting in processing/waiting with no signal. */
export type Motion = "moving" | "stuck";

/** Idle processing/waiting this long with no progress and no timeLeft is stuck. */
export const STUCK_MS = 2 * 60 * 60 * 1000;

/** At most one auto-retry per Overseerr request id in this window. */
export const RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** SyncLog.source prefix — existing table, no TV-request migration. */
export const TV_RETRY_LOG_PREFIX = "tv-retry-";

export type DownloadBit = {
  size?: number;
  sizeLeft?: number;
  status?: string;
  timeLeft?: string;
  title?: string;
  episode?: { seasonNumber?: number; episodeNumber?: number };
};

export type RawMedia = {
  id?: number;
  tmdbId?: number;
  tvdbId?: number;
  mediaType?: string;
  status?: number;
  status4k?: number;
  externalServiceId?: number | null;
  downloadStatus?: DownloadBit[];
  downloadStatus4k?: DownloadBit[];
  posterPath?: string;
  title?: string;
  name?: string;
  releaseDate?: string;
  firstAirDate?: string;
};

export type RawRequest = {
  id?: number;
  status?: number;
  type?: string;
  is4k?: boolean;
  profileId?: number | null;
  rootFolder?: string | null;
  createdAt?: string;
  updatedAt?: string;
  media?: RawMedia;
  seasons?: Array<{ seasonNumber?: number; status?: number }>;
};

export type PipelineItem = {
  id: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  poster: string | null;
  quality: Quality;
  profileId: number | null;
  externalServiceId: number | null;
  bucket: PipelineBucket;
  requestStatus: number;
  mediaStatus: number;
  progress: number | null;
  downloadLabel: string | null;
  timeLeft: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Milliseconds since stateEnteredAt (updatedAt, else createdAt). */
  ageMs: number | null;
  /** e.g. "in queue 3h 12m" — shown on processing/waiting rows. */
  ageLabel: string | null;
  /** Only set for downloading/waiting buckets. */
  motion: Motion | null;
  /** True when downloadLabel/status looks import pending or blocked (NAS, not a grab). */
  importBlocked: boolean;
  /** Last auto-retry timestamp if we have one (SyncLog). */
  lastRetryAt: string | null;
  /** e.g. "retried 18m ago" */
  retriedLabel: string | null;
};

export function requestQuality(req: RawRequest): Quality {
  const mediaType = req.type === "tv" || req.media?.mediaType === "tv" ? "tv" : "movie";
  if (mediaType === "tv") return "hd";
  if (Number(req.profileId) === UHD_PROFILE_ID) return "4k";
  if (Number(req.profileId) === HD_PROFILE_ID) return "hd";
  return "hd";
}

export function progressPercent(downloads: DownloadBit[] | undefined): number | null {
  if (!Array.isArray(downloads) || downloads.length === 0) return null;
  let size = 0;
  let left = 0;
  let any = false;
  for (const d of downloads) {
    const s = Number(d.size);
    const l = Number(d.sizeLeft);
    if (!Number.isFinite(s) || s <= 0) continue;
    any = true;
    size += s;
    left += Number.isFinite(l) && l >= 0 ? l : 0;
  }
  if (!any || size <= 0) return null;
  const pct = Math.round(((size - left) / size) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function activeDownloads(req: RawRequest): DownloadBit[] {
  const media = req.media || {};
  const bits = media.downloadStatus;
  return Array.isArray(bits) ? bits : [];
}

export function activeMediaStatus(req: RawRequest): number {
  return Number(req.media?.status) || 0;
}

export function classifyRequest(req: RawRequest): PipelineBucket {
  const reqStatus = Number(req.status) || 0;
  const mediaStatus = activeMediaStatus(req);
  const downloads = activeDownloads(req);
  const hasQueue = downloads.length > 0;

  if (reqStatus === RequestStatus.FAILED) return "needs_retry";
  if (reqStatus === RequestStatus.DECLINED) return "failed";
  if (mediaStatus === MediaStatus.DELETED) return "failed";
  if (mediaStatus === MediaStatus.AVAILABLE || reqStatus === RequestStatus.COMPLETED) {
    return hasQueue ? "downloading" : "available";
  }
  if (hasQueue || mediaStatus === MediaStatus.PROCESSING || mediaStatus === MediaStatus.PARTIALLY_AVAILABLE) {
    return "downloading";
  }
  return "waiting";
}

/**
 * Overseerr timestamp that best reflects time in the current pipeline state.
 *
 * Prefer `updatedAt`: Overseerr bumps it when request/media status changes
 * (pending → approved → processing). `createdAt` is the original request and
 * would overstate time-in-state after those transitions. Fall back to
 * `createdAt` when `updatedAt` is missing.
 */
export function stateEnteredAt(req: Pick<RawRequest, "createdAt" | "updatedAt">): string | null {
  return req.updatedAt || req.createdAt || null;
}

export function queueAgeMs(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

/** Human queue clock: "in queue 3h 12m". Minute granularity; hours may exceed 24. */
export function formatQueueAge(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `in queue ${m}m`;
  if (m <= 0) return `in queue ${h}h`;
  return `in queue ${h}h ${m}m`;
}

export function mentionsImportPendingOrBlocked(label: string | null | undefined): boolean {
  return isImportBlockedLabel(label);
}

/** NAS import pending / blocked — remount or free disk; do not fire another grab. */
export function isImportBlockedLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const t = label.toLowerCase();
  const compact = t.replace(/[_\s-]+/g, "");
  return (
    compact.includes("importpending") ||
    compact.includes("importblocked") ||
    t.includes("import pending") ||
    t.includes("import blocked") ||
    /\bblocked\b/.test(t)
  );
}

export function isImportBlockedForRetry(
  item: Pick<PipelineItem, "downloadLabel" | "importBlocked"> | { downloadLabel?: string | null; importBlocked?: boolean },
  extraLabels: Array<string | null | undefined> = [],
): boolean {
  if (item.importBlocked) return true;
  if (isImportBlockedLabel(item.downloadLabel)) return true;
  return extraLabels.some((l) => isImportBlockedLabel(l));
}

function hasTimeLeft(timeLeft: string | null | undefined): boolean {
  return Boolean(timeLeft && String(timeLeft).trim());
}

export type MotionInput = Pick<
  PipelineItem,
  "bucket" | "progress" | "timeLeft" | "downloadLabel" | "mediaStatus" | "ageMs"
>;

/**
 * Split processing/waiting into moving vs stuck.
 *
 * moving: progress>0 or timeLeft, and (for the idle clock) not stuck.
 *   A row that is actually transferring stays moving even after STUCK_MS —
 *   the clock is for idle/import-blocked rows, not healthy 4K grabs.
 * stuck:
 *   - processing/waiting with no progress AND no timeLeft for >= STUCK_MS, OR
 *   - downloadLabel mentions import pending/blocked, OR
 *   - mediaStatus PROCESSING with 0/null progress for >= STUCK_MS.
 */
export function classifyMotion(item: MotionInput, stuckMs = STUCK_MS): Motion | null {
  if (item.bucket !== "downloading" && item.bucket !== "waiting") return null;

  const age = item.ageMs ?? 0;
  const progress = item.progress;
  const hasProgress = progress != null && progress > 0;
  const noProgress = progress == null || progress === 0;
  const timeLeft = hasTimeLeft(item.timeLeft);

  if (mentionsImportPendingOrBlocked(item.downloadLabel)) return "stuck";
  if (item.mediaStatus === MediaStatus.PROCESSING && noProgress && age >= stuckMs) return "stuck";
  if (noProgress && !timeLeft && age >= stuckMs) return "stuck";

  if (hasProgress || timeLeft) return "moving";
  if (age < stuckMs) return "moving";
  return "stuck";
}

export type AutoRetryDecision = { retry: boolean; reason: string };

/**
 * Built-in watcher: retry a stuck row once via Overseerr POST /request/{id}/retry.
 * Never retries import pending/blocked (NAS). At most one retry per id per 24h
 * when lastRetryAt is known (SyncLog). Does not use updatedAt as the cooldown
 * clock — that stamp is the stuck age, and at 2h it is still inside 24h.
 */
export function shouldAutoRetry(
  item: Pick<PipelineItem, "motion" | "ageMs" | "downloadLabel"> & {
    importBlocked?: boolean;
    lastRetryAt?: string | null;
  },
  opts?: { now?: number; lastRetryAt?: string | null; stuckMs?: number; cooldownMs?: number },
): AutoRetryDecision {
  if (isImportBlockedForRetry(item)) {
    return { retry: false, reason: "import_blocked" };
  }
  if (item.motion !== "stuck") {
    return { retry: false, reason: "not_stuck" };
  }
  const age = item.ageMs ?? 0;
  if (age < (opts?.stuckMs ?? STUCK_MS)) {
    return { retry: false, reason: "under_stuck_ms" };
  }
  const lastRetry = opts?.lastRetryAt ?? item.lastRetryAt ?? null;
  if (lastRetry) {
    const t = Date.parse(lastRetry);
    const cooldown = opts?.cooldownMs ?? RETRY_COOLDOWN_MS;
    const now = opts?.now ?? Date.now();
    if (Number.isFinite(t) && now - t < cooldown) {
      return { retry: false, reason: "cooldown" };
    }
  }
  return { retry: true, reason: "stuck" };
}

/** Human retry stamp: "retried 18m ago". */
export function formatRetriedAgo(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `retried ${m}m ago`;
  if (m <= 0) return `retried ${h}h ago`;
  return `retried ${h}h ${m}m ago`;
}

export function overseerrRetryPath(id: number): string {
  return `/api/v1/request/${id}/retry`;
}

export function tvRetryLogSource(requestId: number): string {
  return `${TV_RETRY_LOG_PREFIX}${requestId}`;
}

export function parseTvRetryLogSource(source: string): number | null {
  if (!source.startsWith(TV_RETRY_LOG_PREFIX)) return null;
  const n = Number(source.slice(TV_RETRY_LOG_PREFIX.length));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type RetryFn = (id: number) => Promise<{ ok: boolean; status?: number; error?: string }>;

export type StuckRetryResult = {
  retried: Array<{ id: number; title: string }>;
  skipped: Array<{ id: number; title: string; reason: string }>;
};

/** Pure runner — tests inject retry(). Cron supplies Overseerr POST + optional SyncLog. */
export async function runStuckRetries(
  items: PipelineItem[],
  deps: {
    retry: RetryFn;
    now?: number;
    lastRetryAtById?: Map<number, string>;
    recordRetry?: (id: number, at: string) => Promise<void>;
    log?: (msg: string, extra?: Record<string, unknown>) => void;
  },
): Promise<StuckRetryResult> {
  const now = deps.now ?? Date.now();
  const lastById = deps.lastRetryAtById ?? new Map<number, string>();
  const log = deps.log ?? ((msg, extra) => console.log(`[tv-stuck-retry] ${msg}`, extra || ""));
  const retried: StuckRetryResult["retried"] = [];
  const skipped: StuckRetryResult["skipped"] = [];

  for (const item of items) {
    if (!item.id) continue;
    const decision = shouldAutoRetry(item, {
      now,
      lastRetryAt: lastById.get(item.id) ?? item.lastRetryAt,
    });
    if (!decision.retry) {
      if (decision.reason !== "not_stuck" && decision.reason !== "under_stuck_ms") {
        skipped.push({ id: item.id, title: item.title, reason: decision.reason });
      }
      continue;
    }

    const res = await deps.retry(item.id);
    if (!res.ok) {
      skipped.push({
        id: item.id,
        title: item.title,
        reason: res.error || `retry_http_${res.status ?? 0}`,
      });
      log("retry failed", { id: item.id, title: item.title, status: res.status, error: res.error });
      continue;
    }

    const at = new Date(now).toISOString();
    lastById.set(item.id, at);
    if (deps.recordRetry) {
      try {
        await deps.recordRetry(item.id, at);
      } catch (e) {
        log("recordRetry failed (cooldown is best-effort this invoke)", {
          id: item.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    retried.push({ id: item.id, title: item.title });
    log("retried", {
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      quality: item.quality,
      profileId: item.profileId,
      path: overseerrRetryPath(item.id),
    });
  }

  return { retried, skipped };
}

export function tmdbPoster(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
}

export function toPipelineItem(
  req: RawRequest,
  titleHint?: { title?: string; year?: string; posterPath?: string | null },
  opts?: { now?: number; stuckMs?: number; lastRetryAt?: string | null },
): PipelineItem {
  const media = req.media || {};
  const mediaType: "movie" | "tv" = req.type === "tv" || media.mediaType === "tv" ? "tv" : "movie";
  const downloads = activeDownloads(req);
  const first = downloads[0];
  const tmdbId = Number(media.tmdbId) || 0;
  const title =
    titleHint?.title ||
    media.title ||
    media.name ||
    (tmdbId ? `${mediaType === "tv" ? "TV" : "Movie"} #${tmdbId}` : `Request #${req.id ?? "?"}`);
  const year =
    titleHint?.year ||
    String(media.releaseDate || media.firstAirDate || "").slice(0, 4);
  const ext = Number(media.externalServiceId);
  const downloadLabel =
    first?.status ||
    (mediaStatusLabel(activeMediaStatus(req), Number(req.status) || 0));
  const enteredAt = stateEnteredAt(req);
  const now = opts?.now ?? Date.now();
  const ageMs = queueAgeMs(enteredAt, now);
  const bucket = classifyRequest(req);
  const progress = progressPercent(downloads);
  const timeLeft = first?.timeLeft || null;
  const mediaStatus = activeMediaStatus(req);
  const importBlocked =
    isImportBlockedLabel(downloadLabel) || downloads.some((d) => isImportBlockedLabel(d.status));
  const lastRetryAt = opts?.lastRetryAt ?? null;
  const retriedLabel = formatRetriedAgo(queueAgeMs(lastRetryAt, now));

  return {
    id: Number(req.id) || 0,
    tmdbId,
    mediaType,
    title,
    year,
    poster: tmdbPoster(titleHint?.posterPath ?? media.posterPath),
    quality: requestQuality(req),
    profileId: req.profileId == null ? null : Number(req.profileId),
    externalServiceId: Number.isFinite(ext) && ext > 0 ? ext : null,
    bucket,
    requestStatus: Number(req.status) || 0,
    mediaStatus,
    progress,
    downloadLabel,
    timeLeft,
    createdAt: req.createdAt || null,
    updatedAt: enteredAt,
    ageMs,
    ageLabel: formatQueueAge(ageMs),
    motion: classifyMotion(
      { bucket, progress, timeLeft, downloadLabel, mediaStatus, ageMs },
      opts?.stuckMs ?? STUCK_MS,
    ),
    importBlocked,
    lastRetryAt,
    retriedLabel,
  };
}

function mediaStatusLabel(mediaStatus: number, requestStatus: number): string | null {
  if (requestStatus === RequestStatus.FAILED) return "failed — needs retry";
  if (requestStatus === RequestStatus.DECLINED) return "declined";
  if (mediaStatus === MediaStatus.PROCESSING) return "processing (import pending / blocked on NAS)";
  if (mediaStatus === MediaStatus.PARTIALLY_AVAILABLE) return "partial — more incoming";
  if (mediaStatus === MediaStatus.PENDING) return "requested";
  if (mediaStatus === MediaStatus.AVAILABLE) return "on Plex";
  if (mediaStatus === MediaStatus.DELETED) return "deleted";
  return null;
}
