import { combineCaptionAndTags, type PostInput, type PostResult } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";

/**
 * YouTube Data API v3 video upload using a refresh token.
 *
 * Env required (one-time OAuth completion via /home/jelly/content-autopilot/publishers/youtube_publisher.py --reauth):
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 *
 * Optional:
 *   YOUTUBE_PRIVACY_STATUS   default "public"
 *   YOUTUBE_CATEGORY_ID      default "22" (People & Blogs)
 */
export async function postYouTube(input: PostInput): Promise<PostResult> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, error: "YouTube not connected — see playbook step 1 (re-auth)" };
  }
  if (input.mediaType !== "video") {
    return { ok: false, error: "YouTube requires a video" };
  }

  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
  if (!accessToken.ok) return accessToken;

  // Stream media from the blob URL into the YouTube resumable upload.
  const mediaRes = await fetch(input.mediaUrl);
  if (!mediaRes.ok || !mediaRes.body) {
    return { ok: false, error: `Could not fetch media (${mediaRes.status})` };
  }
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  const contentType = mediaRes.headers.get("content-type") || "video/mp4";

  const metadata = {
    snippet: {
      title: (input.title ?? input.caption.slice(0, 90)) || "Untitled",
      description: combineCaptionAndTags(input),
      tags: input.hashtags.map((t) => t.replace(/^#/, "")),
      categoryId: process.env.YOUTUBE_CATEGORY_ID || "22",
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const boundary = `----social-boundary-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `YouTube upload ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { id: string };
  return {
    ok: true,
    externalId: json.id,
    url: `https://youtu.be/${json.id}`,
  };
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `YT token refresh ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { access_token: string };
  return { ok: true, token: json.access_token };
}
