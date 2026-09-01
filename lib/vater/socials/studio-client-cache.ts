/**
 * In-memory / session cache for Socials first paint and the Socials → Library
 * jump. Screens remount on route change (Shell switch), so this cannot live
 * in React state.
 *
 * Lite studio JSON (ids, titles, thumbnailUrl / previewKind) is enough to
 * paint the grid. Zernio / house match hydrate on the full payload.
 * Clicking a tile stores a Library seed so the player can open before
 * GET /api/vater/youtube returns the whole grid.
 */
import { YOUTUBE_POSTED_KEY } from "@/lib/vater/youtube-posted";
import type { StudioHighlight, StudioVideo } from "@/lib/vater/socials/studio-library";

export interface StudioClientPayload {
  workspace?: { userId: string; name: string; isPrimary: boolean };
  videos?: StudioVideo[];
  channels?: unknown[];
  posts?: unknown[];
  collecting?: boolean;
  connectedAccounts?: number;
  queueCount?: number;
  encouragement?: string;
  highlight?: StudioHighlight | null;
  lite?: boolean;
}

export interface LibraryProjectSeed {
  id: string;
  mode: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  topic: string | null;
  audioDuration: number | null;
  scenesJson: unknown;
  script: string | null;
  verifiedScript: boolean;
  verificationReport: unknown;
  completedAt: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
  stylePreset: string | null;
  autopilotJobId: string | null;
  targetDuration: number;
  status: string;
  editedAt: string | null;
  finalVideoUrl: string | null;
  youtubeVideoId: string | null;
  publishedAt: string | null;
  settingsJson: unknown;
}

type CacheEntry = { payload: StudioClientPayload; at: number };

const studioMem = new Map<string, CacheEntry>();
const SS_PREFIX = "vater-studio-socials:";
const STALE_MS = 60_000;

let libraryJumpSeed: LibraryProjectSeed | null = null;
let libraryProjectsCache: LibraryProjectSeed[] | null = null;

function ssGet(key: string): CacheEntry | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed !== "object" || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function ssSet(key: string, entry: CacheEntry): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}

export function studioCacheKey(workspaceId: string | null | undefined, windowDays: number): string {
  return `${workspaceId || "me"}:${windowDays}`;
}

export function readStudioPayloadCache(key: string): StudioClientPayload | null {
  const mem = studioMem.get(key);
  if (mem) return mem.payload;
  const stored = ssGet(key);
  if (!stored) return null;
  studioMem.set(key, stored);
  return stored.payload;
}

export function writeStudioPayloadCache(key: string, payload: StudioClientPayload): void {
  const existing = studioMem.get(key) ?? ssGet(key);
  if (existing && !existing.payload.lite && payload.lite) return;
  const entry = { payload, at: Date.now() };
  studioMem.set(key, entry);
  ssSet(key, entry);
}

export function studioCacheIsFresh(key: string, maxAgeMs = STALE_MS): boolean {
  const mem = studioMem.get(key) ?? ssGet(key);
  if (!mem || mem.payload.lite) return false;
  return Date.now() - mem.at < maxAgeMs;
}

export function studioVideoToLibrarySeed(video: StudioVideo): LibraryProjectSeed {
  const scenesJson = video.firstSceneImage
    ? [{ imageUrl: video.firstSceneImage }]
    : [];
  return {
    id: video.id,
    mode: null,
    sourceTitle: video.title,
    sourceUrl: null,
    topic: null,
    audioDuration: null,
    scenesJson,
    script: null,
    verifiedScript: false,
    verificationReport: null,
    completedAt: video.completedAt,
    createdAt: video.createdAt,
    thumbnailUrl: video.thumbnailUrl,
    stylePreset: video.stylePreset,
    autopilotJobId: null,
    targetDuration: 0,
    status: video.status,
    editedAt: null,
    finalVideoUrl: video.finalVideoUrl,
    youtubeVideoId: video.youtubeVideoId,
    publishedAt: video.publishedAt,
    settingsJson: video.posted ? { [YOUTUBE_POSTED_KEY]: true } : null,
  };
}

export function rememberLibraryJump(video: StudioVideo): LibraryProjectSeed {
  const seed = studioVideoToLibrarySeed(video);
  libraryJumpSeed = seed;
  return seed;
}

export function peekLibraryJumpSeed(): LibraryProjectSeed | null {
  return libraryJumpSeed;
}

export function readLibraryProjectsCache(): LibraryProjectSeed[] | null {
  return libraryProjectsCache;
}

export function writeLibraryProjectsCache(projects: LibraryProjectSeed[]): void {
  libraryProjectsCache = projects;
}

export function mergeLibraryProjects<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  seed: T | null,
): T[] {
  const byId = new Map<string, T>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of incoming) byId.set(p.id, { ...(byId.get(p.id) as T), ...p });
  if (seed && !byId.has(seed.id)) byId.set(seed.id, seed);
  const order = incoming.length ? incoming.map((p) => p.id) : [...byId.keys()];
  if (seed && !order.includes(seed.id)) order.unshift(seed.id);
  return order.map((id) => byId.get(id)).filter((p): p is T => Boolean(p));
}

export function canOpenLibraryPlayer<T extends { id: string }>(
  projects: T[],
  selectedId: string | null | undefined,
): boolean {
  if (!selectedId) return false;
  return projects.some((p) => p.id === selectedId);
}

/** Socials tile click: seed the player, then sync route + selected id. */
export function openStudioVideoInLibrary(
  video: StudioVideo,
  nav: {
    setSelectedProjectId: (next: string | null) => void;
    setRoute: (next: string) => void;
  },
): void {
  rememberLibraryJump(video);
  nav.setSelectedProjectId(video.id);
  nav.setRoute("library");
}
