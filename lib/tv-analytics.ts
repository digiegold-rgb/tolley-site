/**
 * Read-only mapping for the Tolley TV Analytics tab.
 *
 * Acquire path (unchanged): Overseerr → Sonarr/Radarr → Transmission → Plex.
 * This site requests 4K movies with Radarr profileId 5 (Ultra-HD); default
 * HD-1080p is profileId 4. It does not set Overseerr's is4k flag.
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
  bucket: PipelineBucket;
  requestStatus: number;
  mediaStatus: number;
  progress: number | null;
  downloadLabel: string | null;
  timeLeft: string | null;
  updatedAt: string | null;
};

export type StorageVolume = {
  service: "radarr" | "sonarr";
  name: string;
  path: string;
  profileName: string;
  is4k: boolean;
};

export type ArrSettings = {
  name?: string;
  activeDirectory?: string;
  activeProfileName?: string;
  is4k?: boolean;
  apiKey?: string;
  hostname?: string;
};

export function requestQuality(req: RawRequest): Quality {
  if (req.is4k === true) return "4k";
  if (Number(req.profileId) === UHD_PROFILE_ID) return "4k";
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
  const use4k = req.is4k === true;
  const bits = use4k ? media.downloadStatus4k : media.downloadStatus;
  return Array.isArray(bits) ? bits : [];
}

export function activeMediaStatus(req: RawRequest): number {
  const media = req.media || {};
  const raw = req.is4k === true ? media.status4k : media.status;
  return Number(raw) || 0;
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

export function tmdbPoster(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
}

export function toPipelineItem(
  req: RawRequest,
  titleHint?: { title?: string; year?: string; posterPath?: string | null },
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

  return {
    id: Number(req.id) || 0,
    tmdbId,
    mediaType,
    title,
    year,
    poster: tmdbPoster(titleHint?.posterPath ?? media.posterPath),
    quality: requestQuality(req),
    profileId: req.profileId == null ? null : Number(req.profileId),
    bucket: classifyRequest(req),
    requestStatus: Number(req.status) || 0,
    mediaStatus: activeMediaStatus(req),
    progress: progressPercent(downloads),
    downloadLabel: first?.status || null,
    timeLeft: first?.timeLeft || null,
    updatedAt: req.updatedAt || req.createdAt || null,
  };
}

export function volumesFromArr(
  service: "radarr" | "sonarr",
  rows: unknown,
): StorageVolume[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row): StorageVolume | null => {
      if (!row || typeof row !== "object") return null;
      const s = row as ArrSettings;
      const path = String(s.activeDirectory || "").trim();
      const name = String(s.name || service).trim() || service;
      if (!path && !name) return null;
      return {
        service,
        name,
        path: path || "(no root folder)",
        profileName: String(s.activeProfileName || "").trim(),
        is4k: s.is4k === true,
      };
    })
    .filter((v): v is StorageVolume => v !== null);
}

export function plexFromSettings(data: unknown): { connected: boolean; name: string | null } {
  if (!data || typeof data !== "object") return { connected: false, name: null };
  const s = data as { name?: string; machineId?: string; ip?: string };
  const name = typeof s.name === "string" && s.name.trim() ? s.name.trim() : null;
  const connected = Boolean(s.machineId || s.ip || name);
  return { connected, name };
}
