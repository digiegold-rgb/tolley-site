/**
 * Pure Socials / dashboard helpers for a single studio tab's library.
 *
 * No Prisma. Used by the studio + overview API routes and their tests.
 * House-wide ads / channel totals do NOT live here — those stay on the
 * owner dashboard via GET /api/vater/socials/house.
 */

import { isPostedToYoutube } from "@/lib/vater/youtube-posted";
import { customerStage, type CustomerStage } from "@/lib/vater/youtube-status";
import { firstScenePreviewUrl, libraryCardPreviewKind } from "@/lib/vater/library-card-preview";

export type StudioDripStage = "queued" | "scheduled" | "publishing" | "published" | null;

export interface HouseVideoMatchInput {
  videoId: string;
  title: string;
  views: number;
  url: string | null;
  channelLabel: string;
  platform: string;
}

export interface StudioProjectInput {
  id: string;
  userId?: string | null;
  sourceTitle?: string | null;
  publishTitle?: string | null;
  topic?: string | null;
  sourceUrl?: string | null;
  status?: string | null;
  thumbnailUrl?: string | null;
  finalVideoUrl?: string | null;
  scenesJson?: unknown;
  completedAt?: string | Date | null;
  createdAt?: string | Date;
  publishedAt?: string | Date | null;
  youtubeVideoId?: string | null;
  settingsJson?: unknown;
  stylePreset?: string | null;
  updatedAt?: string | Date | null;
  stepDetails?: unknown;
}

export interface StudioVideo {
  id: string;
  /** Which library the tile opens: YouTubeProject (default) or VaterListingJob. */
  source?: "youtube" | "listing";
  title: string;
  status: string;
  stage: CustomerStage | null;
  posted: boolean;
  thumbnailUrl: string | null;
  firstSceneImage: string | null;
  finalVideoUrl: string | null;
  previewKind: ReturnType<typeof libraryCardPreviewKind>;
  completedAt: string | null;
  createdAt: string;
  publishedAt: string | null;
  youtubeVideoId: string | null;
  stylePreset: string | null;
  dripStage: StudioDripStage;
  views: number | null;
  likes: number | null;
  houseMatch: {
    views: number;
    url: string | null;
    channelLabel: string;
    platform: string;
  } | null;
}

export interface StudioHighlight {
  kind: "views" | "posted" | "ready";
  label: string;
  value: number;
}

const LIVE_DRIP = new Set(["scheduled", "publishing", "draft", "queued", "pending"]);

export function iso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const s = String(value);
  return s.trim() ? s : null;
}

export function projectTitle(p: StudioProjectInput): string {
  const title = p.publishTitle || p.sourceTitle || p.topic;
  if (typeof title === "string" && title.trim()) return title.trim();
  return p.id;
}

export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[#\d]+ — /g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function youtubeIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    const v = u.searchParams.get("v");
    if (v) return v;
    const parts = u.pathname.split("/").filter(Boolean);
    const shorts = parts[0] === "shorts" ? parts[1] : null;
    return shorts || null;
  } catch {
    return null;
  }
}

export function dripStageOf(status: string | null | undefined): StudioDripStage {
  if (!status) return null;
  if (status === "published" || status === "partial") return "published";
  if (status === "publishing") return "publishing";
  if (status === "scheduled") return "scheduled";
  if (LIVE_DRIP.has(status)) return "queued";
  return null;
}

/**
 * Match one studio library row to an HQ view-counter video.
 * Used to stamp THAT video's numbers on a Socials tile — never house totals.
 */
export function matchHouseVideo(
  project: StudioProjectInput,
  house: HouseVideoMatchInput[],
): HouseVideoMatchInput | null {
  const ytId =
    (typeof project.youtubeVideoId === "string" && project.youtubeVideoId.trim()) ||
    youtubeIdFromUrl(project.sourceUrl) ||
    null;
  if (ytId) {
    const byId = house.find((h) => h.videoId === ytId || youtubeIdFromUrl(h.url) === ytId);
    if (byId) return byId;
  }
  const want = normalizeTitle(projectTitle(project));
  if (want.length < 8) return null;
  return house.find((h) => normalizeTitle(h.title) === want) ?? null;
}

export function shapeStudioVideo(
  project: StudioProjectInput,
  extras?: {
    dripStage?: StudioDripStage;
    views?: number | null;
    likes?: number | null;
    house?: HouseVideoMatchInput | null;
    hasPresetSample?: boolean;
  },
): StudioVideo {
  const firstSceneImage = firstScenePreviewUrl(project.scenesJson);
  const house = extras?.house ?? null;
  const views = extras?.views ?? house?.views ?? null;
  return {
    id: project.id,
    title: projectTitle(project),
    status: project.status ?? "draft",
    stage: customerStage({
      status: project.status,
      finalVideoUrl: project.finalVideoUrl,
      updatedAt: project.updatedAt,
      stepDetails: project.stepDetails,
    }),
    // A house-matched clip IS live on a channel — the DGX house pipeline
    // posts outside VaterSocialPost, so without this every posted clip
    // reads "Ready — post this".
    posted: isPostedToYoutube(project) || house !== null,
    thumbnailUrl: project.thumbnailUrl ?? null,
    firstSceneImage,
    finalVideoUrl: project.finalVideoUrl ?? null,
    previewKind: libraryCardPreviewKind({
      firstSceneImage,
      thumbnailUrl: project.thumbnailUrl,
      finalVideoUrl: project.finalVideoUrl,
      hasPresetSample: extras?.hasPresetSample,
    }),
    completedAt: iso(project.completedAt),
    createdAt: iso(project.createdAt) ?? new Date(0).toISOString(),
    publishedAt: iso(project.publishedAt),
    youtubeVideoId: project.youtubeVideoId ?? null,
    stylePreset: project.stylePreset ?? null,
    dripStage: extras?.dripStage ?? null,
    views,
    likes: extras?.likes ?? null,
    houseMatch: house
      ? {
          views: house.views,
          url: house.url,
          channelLabel: house.channelLabel,
          platform: house.platform,
        }
      : null,
  };
}

export function studioHighlight(videos: StudioVideo[]): StudioHighlight | null {
  const viewRows = videos.filter((v) => v.views != null && v.views > 0);
  if (viewRows.length) {
    const best = Math.max(...viewRows.map((v) => v.views ?? 0));
    return { kind: "views", label: "Top clip views", value: best };
  }
  const posted = videos.filter((v) => v.posted).length;
  if (posted > 0) return { kind: "posted", label: "Posted", value: posted };
  const ready = videos.filter((v) => v.stage === "done" && v.finalVideoUrl).length;
  if (ready > 0) return { kind: "ready", label: "Ready to post", value: ready };
  return null;
}

/** Short line under the studio name. Empty studio always CTAs into Create. */
export function studioEncouragement(studioName: string, videos: StudioVideo[]): string {
  const name = studioName.trim() || "This studio";
  if (videos.length === 0) {
    return `${name} is waiting — make a video and this tab lights up.`;
  }
  const views = videos.reduce((s, v) => s + (v.views ?? 0), 0);
  const posted = videos.filter((v) => v.posted).length;
  const ready = videos.filter((v) => v.stage === "done" && v.finalVideoUrl).length;
  const cooking = videos.filter((v) => v.stage === "in_progress" || v.stage === "queued").length;
  if (views > 0 && posted > 0) {
    return `${name} is cooking — ${views.toLocaleString()} views across ${posted} posted clip${posted === 1 ? "" : "s"}.`;
  }
  if (posted > 0) {
    return `${name} has ${posted} live. Keep the streak going.`;
  }
  if (ready > 0) {
    return `${name} has ${ready} ready to post. You're doing well — ship another.`;
  }
  if (cooking > 0) {
    return `${name} is in production. Nice.`;
  }
  return `${name} is cooking.`;
}

/** A finished Listing Studio reel (VaterListingJob), shaped like a tile.
 *  Listing jobs have a staged still — a real image, so the tile never has
 *  to mount the mp4 at rest. They never drip and are never house-matched. */
export function shapeListingVideo(job: {
  id: string;
  status: string;
  address?: string | null;
  city?: string | null;
  roomType?: string | null;
  stagedStillUrl?: string | null;
  stagedStillLabeledUrl?: string | null;
  finalUrl?: string | null;
  videoUrl?: string | null;
  videoVerticalUrl?: string | null;
  completedAt?: string | Date | null;
  createdAt?: string | Date;
}): StudioVideo {
  const title =
    (job.address && job.address.trim()) ||
    (job.roomType ? `${job.roomType} reel` : "Listing reel");
  const still = job.stagedStillLabeledUrl || job.stagedStillUrl || null;
  const finalVideoUrl = job.finalUrl || job.videoUrl || job.videoVerticalUrl || null;
  return {
    id: job.id,
    source: "listing",
    title: job.city ? `${title} — ${job.city}` : title,
    status: job.status,
    stage: job.status === "ready" && finalVideoUrl ? "done" : "in_progress",
    posted: false,
    thumbnailUrl: still,
    firstSceneImage: null,
    finalVideoUrl,
    previewKind: libraryCardPreviewKind({
      thumbnailUrl: still,
      finalVideoUrl,
    }),
    completedAt: iso(job.completedAt),
    createdAt: iso(job.createdAt) ?? new Date(0).toISOString(),
    publishedAt: null,
    youtubeVideoId: null,
    stylePreset: null,
    dripStage: null,
    views: null,
    likes: null,
    houseMatch: null,
  };
}

/** Finished / playable first, then recently updated. */
export function sortStudioVideos(videos: StudioVideo[]): StudioVideo[] {
  return [...videos].sort((a, b) => {
    const av = a.views ?? -1;
    const bv = b.views ?? -1;
    if (bv !== av) return bv - av;
    if (Number(b.posted) !== Number(a.posted)) return Number(b.posted) - Number(a.posted);
    const at = Date.parse(a.completedAt ?? a.createdAt);
    const bt = Date.parse(b.completedAt ?? b.createdAt);
    return bt - at;
  });
}
