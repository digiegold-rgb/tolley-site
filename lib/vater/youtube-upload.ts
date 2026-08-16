/**
 * lib/vater/youtube-upload.ts
 *
 * YouTube Data API v3 upload for the Jelly studio publish stage.
 *
 * Adapted from `lib/social/youtube.ts` — deliberately a copy, not an import.
 * That module is Jared's social suite: one set of admin credentials in
 * `PlatformConnection`, driven by cron. This one is per-user, reads its
 * refresh token out of `SocialAccount` (the vater-side store), and only ever
 * runs from an explicit click in the publish panel.
 *
 * Serverless limits inherited from the original: the whole file plus the
 * multipart envelope live in memory, so uploads are capped at 512MB (vater
 * finals run 40-80MB) and the request is aborted rather than left to ride
 * out maxDuration.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/** "Education" — vater long-form is explainer content, not vlogs. */
export const YOUTUBE_CATEGORY_EDUCATION = "27";

export type PrivacyStatus = "public" | "unlisted" | "private";

export function isPrivacyStatus(value: unknown): value is PrivacyStatus {
  return value === "public" || value === "unlisted" || value === "private";
}

/** Shape stored in `SocialAccount.credentials` for platform "youtube". */
export interface YouTubeCredentials {
  refreshToken: string;
  accessToken?: string;
  /** ms epoch — when the cached access token stops working. */
  expiresAt?: number;
  channelTitle?: string;
}

export class YouTubeUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeUploadError";
  }
}

export function readCredentials(value: unknown): YouTubeCredentials | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (typeof c.refreshToken !== "string" || !c.refreshToken) return null;
  return {
    refreshToken: c.refreshToken,
    accessToken: typeof c.accessToken === "string" ? c.accessToken : undefined,
    expiresAt: typeof c.expiresAt === "number" ? c.expiresAt : undefined,
    channelTitle:
      typeof c.channelTitle === "string" ? c.channelTitle : undefined,
  };
}

/**
 * Return a usable access token for this user, refreshing if the cached one is
 * gone or within 60s of expiry, and writing the rotated token back so the
 * next upload skips the round trip.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new YouTubeUploadError(
      "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET missing in the environment",
    );
  }

  const account = await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId, platform: "youtube" } },
  });
  const creds = readCredentials(account?.credentials);
  if (!account || !creds) {
    throw new YouTubeUploadError(
      "YouTube is not connected for this account — connect it in the publish panel first",
    );
  }

  if (creds.accessToken && creds.expiresAt && creds.expiresAt - 60_000 > Date.now()) {
    return creds.accessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // A dead refresh token needs a human to re-consent, so mark the row —
    // the publish panel renders `status` and will show it as needing a fix.
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        status: "expired",
        lastError: `token refresh ${res.status}: ${text.slice(0, 200)}`,
      },
    });
    throw new YouTubeUploadError(
      `YouTube token refresh failed (${res.status}) — reconnect the channel. ${text.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new YouTubeUploadError("Google returned no access_token");
  }

  const next: YouTubeCredentials = {
    ...creds,
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      credentials: next as unknown as Prisma.InputJsonValue,
      status: "active",
      lastError: null,
      lastUsedAt: new Date(),
    },
  });

  return json.access_token;
}

export interface UploadVideoInput {
  userId: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: PrivacyStatus;
  /** Open response carrying the final MP4 — the caller decides whether that
   *  came from the Blob CDN or the bearer-authed DGX proxy. */
  media: Response;
  /** Optional custom thumbnail bytes; a failure here never fails the upload. */
  thumbnail?: Response | null;
  categoryId?: string;
  /**
   * Scheduled publish time as an ISO-8601 / RFC-3339 UTC string.
   *
   * YouTube only honours `status.publishAt` on a video that is uploaded
   * PRIVATE — set it on a public/unlisted upload and the API either ignores it
   * or 400s. So when this is present we force `privacyStatus: "private"`
   * regardless of what the caller passed, and YouTube flips the video public
   * at the scheduled moment. See `isFuturePublishAt` for the validation the
   * route runs before it gets here.
   */
  publishAt?: string;
}

/**
 * True when `value` is an ISO timestamp strictly in the future.
 *
 * A past `publishAt` is the dangerous case: YouTube accepts it and publishes
 * the video IMMEDIATELY, which is the opposite of what someone clicking
 * "schedule" wants. Callers reject rather than silently publish.
 */
export function isFuturePublishAt(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms > Date.now();
}

export interface UploadVideoResult {
  videoId: string;
  url: string;
  /** Echo of the honoured schedule, so callers can persist/report it. */
  publishAt?: string;
}

export async function uploadVideoToYouTube(
  input: UploadVideoInput,
): Promise<UploadVideoResult> {
  const accessToken = await getAccessToken(input.userId);

  if (!input.media.ok || !input.media.body) {
    throw new YouTubeUploadError(
      `Could not read the final video (${input.media.status})`,
    );
  }
  const contentLength = Number(input.media.headers.get("content-length") || 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    void input.media.body.cancel().catch(() => {});
    throw new YouTubeUploadError(
      `Final video is too large for a serverless upload (${Math.round(contentLength / 1e6)}MB > 512MB)`,
    );
  }
  const contentType = input.media.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await input.media.arrayBuffer());

  // A scheduled upload MUST go up private — see UploadVideoInput.publishAt.
  const scheduled = input.publishAt
    ? new Date(input.publishAt).toISOString()
    : null;

  const metadata = {
    snippet: {
      title: input.title.slice(0, 100),
      description: input.description.slice(0, 5000),
      tags: input.tags.map((t) => t.replace(/^#/, "")).filter(Boolean),
      categoryId: input.categoryId || YOUTUBE_CATEGORY_EDUCATION,
    },
    status: {
      privacyStatus: scheduled ? "private" : input.privacyStatus,
      selfDeclaredMadeForKids: false,
      ...(scheduled ? { publishAt: scheduled } : {}),
    },
  };

  const boundary = `----vater-boundary-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    ),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(
    `${UPLOAD_URL}?uploadType=multipart&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(240_000),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new YouTubeUploadError(
      `YouTube upload ${res.status}: ${text.slice(0, 400)}`,
    );
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) {
    throw new YouTubeUploadError("YouTube accepted the upload but returned no video id");
  }

  // Custom thumbnail needs "custom thumbnails" enabled on the channel
  // (phone-verified). The video is already live, so a failure here is logged,
  // never thrown — the caller reports success with the watch link.
  if (input.thumbnail?.ok && input.thumbnail.body) {
    try {
      const jpg = Buffer.from(await input.thumbnail.arrayBuffer());
      const up = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${json.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type":
              input.thumbnail.headers.get("content-type") || "image/jpeg",
          },
          body: jpg,
        },
      );
      if (!up.ok) {
        console.warn(
          `[vater/youtube-upload] thumbnails.set ${up.status}: ${(await up.text().catch(() => "")).slice(0, 200)}`,
        );
      }
    } catch (err) {
      console.warn("[vater/youtube-upload] thumbnail upload failed:", err);
    }
  }

  return {
    videoId: json.id,
    url: `https://youtu.be/${json.id}`,
    ...(scheduled ? { publishAt: scheduled } : {}),
  };
}
