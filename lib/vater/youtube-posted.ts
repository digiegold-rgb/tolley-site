/**
 * lib/vater/youtube-posted.ts
 *
 * Effective "posted to YouTube" state for Library cards.
 *
 * In-app OAuth publish writes `youtubeVideoId` + `publishedAt`. Customers who
 * upload via VidIQ or YouTube Studio still need to mark a finished video as
 * posted — that lives on `settingsJson.postedToYoutube` so we don't invent a
 * column or overwrite the OAuth ids.
 *
 * Precedence:
 *   1. Explicit `settingsJson.postedToYoutube` boolean wins (manual mark, or
 *      a safe unmark that leaves youtubeVideoId / publishedAt intact).
 *   2. Otherwise any in-app publish id / timestamp counts as posted.
 *
 * Pure — used on both the client (Library cards) and the posted route.
 */

export const YOUTUBE_POSTED_KEY = "postedToYoutube";
export const YOUTUBE_POSTED_AT_KEY = "postedToYoutubeAt";

export type YoutubePostedProject = {
  youtubeVideoId?: string | null;
  publishedAt?: string | Date | null;
  settingsJson?: unknown;
};

export function settingsBag(settingsJson: unknown): Record<string, unknown> {
  if (
    settingsJson &&
    typeof settingsJson === "object" &&
    !Array.isArray(settingsJson)
  ) {
    return { ...(settingsJson as Record<string, unknown>) };
  }
  return {};
}

function hasPublishId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.trim().length > 0;
}

function hasPublishedAt(value: string | Date | null | undefined): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

/** True when the Library should show the Posted to YouTube badge. */
export function isPostedToYoutube(project: YoutubePostedProject): boolean {
  const flag = settingsBag(project.settingsJson)[YOUTUBE_POSTED_KEY];
  if (flag === false) return false;
  if (flag === true) return true;
  return hasPublishId(project.youtubeVideoId) || hasPublishedAt(project.publishedAt);
}

/** Shallow-merge the explicit posted flag onto the feature bag. */
export function applyPostedToYoutube(
  settingsJson: unknown,
  posted: boolean,
  at: Date = new Date(),
): Record<string, unknown> {
  return {
    ...settingsBag(settingsJson),
    [YOUTUBE_POSTED_KEY]: posted,
    [YOUTUBE_POSTED_AT_KEY]: at.toISOString(),
  };
}
