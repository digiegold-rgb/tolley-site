/**
 * Read-only mapping for the Tolley TV Analytics tab.
 *
 * Live map (DGX-confirmed): Vercel /tv → NAS Overseerr (tv-api.tolley.io)
 * auto-approve → Radarr :7878 / Sonarr :8989 on 192.168.2.196 → Transmission
 * :9091 via gluetun → /mnt/plex-movies and /mnt/plex-tv → Plex :32400.
 *
 * Movies: profileId 4 = HD-1080p, profileId 5 = Ultra-HD on the same Radarr.
 * TV: seasons=all, no 4K path. This tab never talks to tv-dvr / Arr / Plex.
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
  if (!label) return false;
  const t = label.toLowerCase();
  return t.includes("import pending") || t.includes("blocked");
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

export function tmdbPoster(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
}

export function toPipelineItem(
  req: RawRequest,
  titleHint?: { title?: string; year?: string; posterPath?: string | null },
  opts?: { now?: number; stuckMs?: number },
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
