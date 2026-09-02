/**
 * Read-only NAS Arr snapshot (tv-stats.tolley.io).
 *
 * Separate host from Overseerr (tv-api.tolley.io) and Spark DVR (tv-dvr.tolley.io).
 * Auth is the existing TV_API_KEY (same secret as the DVR catch-all).
 * This module never talks to Radarr / Sonarr / Transmission / Plex directly.
 */

export const DEFAULT_TV_STATS_URL = "https://tv-stats.tolley.io";

export type TransmissionBit = {
  name: string;
  percentDone: number | null;
  eta: number | string | null;
  peersConnected: number | null;
  errorString: string | null;
  status: string | number | null;
  downloadDir: string | null;
};

export type ArrQueueBit = {
  title: string;
  trackedDownloadState: string | null;
  sizeleft: number | null;
  timeleft: string | null;
  protocol: string | null;
  status: string | null;
  source: "radarr" | "sonarr";
};

export type DiskSpaceBit = {
  source: string;
  path: string;
  label: string;
  free: number | null;
  total: number | null;
};

export type RootFolderBit = {
  source: string;
  path: string;
  label: string;
  free: number | null;
  total: number | null;
  accessible: boolean | null;
};

export type TvStatsSnapshot = {
  ok: boolean;
  ts: string | null;
  transmission: TransmissionBit[];
  radarrQueue: ArrQueueBit[];
  sonarrQueue: ArrQueueBit[];
  diskspace: DiskSpaceBit[];
  rootfolders: RootFolderBit[];
  errors: string[];
};

export type LiveMatch = {
  source: "transmission" | "radarr" | "sonarr";
  peersConnected: number | null;
  percentDone: number | null;
  eta: string | null;
  timeLeft: string | null;
  trackedDownloadState: string | null;
  status: string | null;
  errorString: string | null;
  downloadDir: string | null;
};

export type StorageVolume = {
  key: string;
  label: string;
  path: string;
  free: number | null;
  total: number | null;
  kind: "plex-movies" | "plex-tv" | "transmission" | "other";
};

export type StorageSummary = {
  volumes: StorageVolume[];
  staleNfs: boolean;
  staleNote: string | null;
  torrentCount: number;
  radarrCount: number;
  sonarrCount: number;
};

const QUALITY_TOKEN =
  /\b(1080p|2160p|720p|480p|4k|uhd|hdr10?|dv|web[- ]?dl|webrip|bluray|blu[- ]?ray|x264|x265|h264|h265|hevc|av1|atmos|dts(?:-hd)?|aac|ac3|remux|proper|repack|internal|multi|complete|season|s\d{1,2}e\d{1,2}|s\d{1,2})\b/gi;

export function normalizeTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/i, " ")
    .replace(QUALITY_TOKEN, " ")
    .replace(/[\[\](){}._,'-]+/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 5 && long.includes(short)) return true;
  const sa = na.split(" ").filter((t) => t.length >= 3);
  const sb = new Set(nb.split(" ").filter((t) => t.length >= 3));
  if (sa.length === 0) return false;
  const hit = sa.filter((t) => sb.has(t)).length;
  const need = Math.min(2, sa.length);
  return hit >= need && hit / sa.length >= 0.6;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function percentDone(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  const pct = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function formatEta(raw: number | string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s || s === "-1" || s === "-2" || /^unknown$/i.test(s)) return null;
    if (/[hmd]/i.test(s) || s.includes(":")) return s;
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    raw = n;
  }
  if (raw < 0 || !Number.isFinite(raw)) return null;
  const sec = Math.round(raw);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min}m`;
  if (min <= 0) return `${h}h`;
  return `${h}h ${min}m`;
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 10 || i === 0 ? 0 : 1;
  return `${v.toFixed(digits)} ${units[i]}`;
}

function parseTransmission(row: unknown): TransmissionBit | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const name = str(r.name ?? r.title);
  if (!name) return null;
  return {
    name,
    percentDone: percentDone(r.percentDone ?? r.percent_done ?? r.progress),
    eta: (r.eta as number | string | null) ?? null,
    peersConnected: num(r.peersConnected ?? r.peers_connected ?? r.peers),
    errorString: str(r.errorString ?? r.error_string ?? r.error),
    status: (r.status as string | number | null) ?? null,
    downloadDir: str(r.downloadDir ?? r.download_dir ?? r.downloadDirectory),
  };
}

function parseArr(row: unknown, source: "radarr" | "sonarr"): ArrQueueBit | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const title = str(r.title ?? r.name);
  if (!title) return null;
  return {
    title,
    trackedDownloadState: str(r.trackedDownloadState ?? r.tracked_download_state),
    sizeleft: num(r.sizeleft ?? r.sizeLeft ?? r.size_left),
    timeleft: str(r.timeleft ?? r.timeLeft ?? r.time_left),
    protocol: str(r.protocol),
    status: str(r.status),
    source,
  };
}

function parseDisk(row: unknown): DiskSpaceBit | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const path = str(r.path) || "";
  const label = str(r.label ?? r.name) || path || "disk";
  return {
    source: str(r.source) || "",
    path,
    label,
    free: num(r.free ?? r.freeSpace ?? r.free_space),
    total: num(r.total ?? r.totalSpace ?? r.total_space),
  };
}

function parseRoot(row: unknown): RootFolderBit | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const path = str(r.path) || "";
  const source = str(r.source ?? r.app) || "";
  let label = str(r.label ?? r.name) || "";
  if (!label) {
    if (/plex-movies|\/movies\b/i.test(path) || /radarr/i.test(source)) label = "plex-movies";
    else if (/plex-tv|\/tv\b/i.test(path) || /sonarr/i.test(source)) label = "plex-tv";
    else label = path || source || "root";
  }
  return {
    source,
    path,
    label,
    free: num(r.free ?? r.freeSpace ?? r.free_space),
    total: num(r.total ?? r.totalSpace ?? r.total_space),
    accessible: typeof r.accessible === "boolean" ? r.accessible : null,
  };
}

export function parseTvStats(data: unknown): TvStatsSnapshot {
  const empty: TvStatsSnapshot = {
    ok: false,
    ts: null,
    transmission: [],
    radarrQueue: [],
    sonarrQueue: [],
    diskspace: [],
    rootfolders: [],
    errors: [],
  };
  if (!data || typeof data !== "object") return empty;
  const d = data as Record<string, unknown>;
  const errors = asArray(d.errors).map((e) => String(e)).filter(Boolean);
  return {
    ok: d.ok !== false,
    ts: str(d.ts ?? d.timestamp ?? d.fetchedAt),
    transmission: asArray(d.transmission).map(parseTransmission).filter((x): x is TransmissionBit => !!x),
    radarrQueue: asArray(d.radarrQueue ?? d.radarr_queue)
      .map((r) => parseArr(r, "radarr"))
      .filter((x): x is ArrQueueBit => !!x),
    sonarrQueue: asArray(d.sonarrQueue ?? d.sonarr_queue)
      .map((r) => parseArr(r, "sonarr"))
      .filter((x): x is ArrQueueBit => !!x),
    diskspace: asArray(d.diskspace ?? d.diskSpace).map(parseDisk).filter((x): x is DiskSpaceBit => !!x),
    rootfolders: asArray(d.rootfolders ?? d.rootFolders).map(parseRoot).filter((x): x is RootFolderBit => !!x),
    errors,
  };
}

export function matchLiveRow(title: string, snap: TvStatsSnapshot): LiveMatch | null {
  const torrent = snap.transmission.find((t) => titlesMatch(title, t.name));
  const arr = [...snap.radarrQueue, ...snap.sonarrQueue].find((q) => titlesMatch(title, q.title));
  if (!torrent && !arr) return null;
  return {
    source: torrent ? "transmission" : arr!.source,
    peersConnected: torrent?.peersConnected ?? null,
    percentDone: torrent?.percentDone ?? null,
    eta: formatEta(torrent?.eta) || arr?.timeleft || null,
    timeLeft: arr?.timeleft || formatEta(torrent?.eta),
    trackedDownloadState: arr?.trackedDownloadState ?? null,
    status: str(torrent?.status) || arr?.status || null,
    errorString: torrent?.errorString ?? null,
    downloadDir: torrent?.downloadDir ?? null,
  };
}

function volumeKind(label: string, path: string): StorageVolume["kind"] {
  const s = `${label} ${path}`.toLowerCase();
  if (s.includes("plex-movies") || /\/movies\b/.test(s)) return "plex-movies";
  if (s.includes("plex-tv") || /\/plex-tv\b/.test(s) || /(^|\/)tv\b/.test(path.toLowerCase())) return "plex-tv";
  if (s.includes("transmission") || s.includes("download")) return "transmission";
  return "other";
}

export function summarizeStorage(snap: TvStatsSnapshot): StorageSummary {
  const volumes: StorageVolume[] = [];
  const seen = new Set<string>();

  for (const r of snap.rootfolders) {
    const kind = volumeKind(r.label, r.path);
    const key = r.label || r.path;
    if (seen.has(key)) continue;
    seen.add(key);
    volumes.push({
      key,
      label: r.label || (kind === "plex-movies" ? "plex-movies" : kind === "plex-tv" ? "plex-tv" : key),
      path: r.path,
      free: r.free,
      total: r.total,
      kind,
    });
  }
  for (const d of snap.diskspace) {
    const kind = volumeKind(d.label, d.path);
    const key = d.label || d.path;
    if (seen.has(key)) continue;
    seen.add(key);
    volumes.push({
      key,
      label: d.label || key,
      path: d.path,
      free: d.free,
      total: d.total,
      kind,
    });
  }

  const transDir = snap.transmission.map((t) => t.downloadDir).find((p) => p);
  if (transDir) {
    const disk = snap.diskspace.find((d) => d.path && transDir.startsWith(d.path));
    const already = volumes.some((v) => v.kind === "transmission" || (v.path && transDir.startsWith(v.path)));
    if (!already) {
      volumes.push({
        key: "transmission-dir",
        label: disk?.label || "Transmission download dir",
        path: disk?.path || transDir,
        free: disk?.free ?? null,
        total: disk?.total ?? null,
        kind: "transmission",
      });
    } else {
      for (const v of volumes) {
        if (v.path && transDir.startsWith(v.path) && v.kind === "other") v.kind = "transmission";
      }
    }
  }

  const plex = volumes.filter((v) => v.kind === "plex-movies" || v.kind === "plex-tv");
  const trans = volumes.find((v) => v.kind === "transmission");
  const plexFree = plex.reduce<number | null>((min, v) => {
    if (v.free == null) return min;
    return min == null ? v.free : Math.min(min, v.free);
  }, null);
  const transFree = trans?.free ?? null;
  const TWO_GB = 2 * 1024 * 1024 * 1024;
  const SIXTY_FOUR_GB = 64 * 1024 * 1024 * 1024;
  const staleNfs =
    plexFree != null && transFree != null && plexFree < TWO_GB && transFree > SIXTY_FOUR_GB;

  return {
    volumes,
    staleNfs,
    staleNote: staleNfs
      ? `Plex mounts look empty (${formatBytes(plexFree)} free) vs Transmission download dir (${formatBytes(transFree)} free) — stale NFS bind.`
      : null,
    torrentCount: snap.transmission.length,
    radarrCount: snap.radarrQueue.length,
    sonarrCount: snap.sonarrQueue.length,
  };
}
