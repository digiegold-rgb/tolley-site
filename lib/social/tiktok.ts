import { combineCaptionAndTags, type PostInput, type PostResult } from "./types";

const TT_API = "https://open.tiktokapis.com/v2";
const REFRESH_URL = `${TT_API}/oauth/token/`;

const SERVICE_URL = process.env.TIKTOK_SERVICE_URL;
const SERVICE_API_KEY = process.env.TIKTOK_SERVICE_API_KEY;

/**
 * Call the DGX-side Selenium service (lib/social/tiktok-service) that drives
 * tiktok.com/creator-center/upload via Chromium. Returns a PostResult so the
 * /social fan-out can treat it identically to the official API path.
 */
async function postViaDGXService(input: PostInput): Promise<PostResult> {
  if (!SERVICE_URL || !SERVICE_API_KEY) {
    return { ok: false, error: "TikTok service URL/key not set" };
  }
  try {
    const res = await fetch(`${SERVICE_URL}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": SERVICE_API_KEY,
      },
      body: JSON.stringify({
        caption: combineCaptionAndTags(input).slice(0, 2200),
        mediaUrl: input.mediaUrl,
      }),
      // Selenium upload + caption + post takes 30-60s typically.
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `TT-svc ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      return { ok: false, error: json.error || "TT service reported failure" };
    }
    return {
      ok: true,
      externalId: `tt-svc-${Date.now()}`,
      url: "https://www.tiktok.com/",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "TT service unreachable" };
  }
}

export async function tiktokServiceHealth(): Promise<{
  ok: boolean;
  logged_in?: boolean;
  error?: string;
}> {
  if (!SERVICE_URL || !SERVICE_API_KEY) return { ok: false, error: "no service URL/key" };
  try {
    const res = await fetch(`${SERVICE_URL}/health`, {
      headers: { "X-API-Key": SERVICE_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { ok: false, error: `health ${res.status}` };
    return (await res.json()) as { ok: boolean; logged_in?: boolean };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  }
}

/**
 * TikTok Content Posting API. Uses PULL_FROM_URL to fetch the video bytes
 * from our blob URL — no chunked upload required.
 *
 * Env (one-time login via headed Playwright session, see playbook step 2):
 *   TIKTOK_CLIENT_KEY
 *   TIKTOK_CLIENT_SECRET
 *   TIKTOK_REFRESH_TOKEN
 *
 * The Content Posting API is gated. App must be approved for video.publish
 * scope. Until approval lands, the SAVE_AS_DRAFT flow can be used by setting
 * TIKTOK_DRAFT_MODE=1.
 */
export async function postTikTok(input: PostInput): Promise<PostResult> {
  if (input.mediaType !== "video") {
    return { ok: false, error: "TikTok requires a video" };
  }

  // Prefer the DGX Selenium service (works today) over the official API
  // (gated behind multi-week app review for video.publish).
  if (SERVICE_URL && SERVICE_API_KEY) {
    return postViaDGXService(input);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;

  if (!clientKey || !clientSecret || !refreshToken) {
    return { ok: false, error: "TikTok not connected — DGX service not running and no API refresh token" };
  }

  const access = await refreshAccessToken(clientKey, clientSecret, refreshToken);
  if (!access.ok) return access;

  const draftMode = process.env.TIKTOK_DRAFT_MODE === "1";
  const endpoint = draftMode
    ? `${TT_API}/post/publish/inbox/video/init/`
    : `${TT_API}/post/publish/video/init/`;

  const body = draftMode
    ? {
        source_info: {
          source: "PULL_FROM_URL",
          video_url: input.mediaUrl,
        },
      }
    : {
        post_info: {
          title: combineCaptionAndTags(input).slice(0, 2200),
          privacy_level: process.env.TIKTOK_PRIVACY || "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: input.mediaUrl,
        },
      };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `TikTok publish ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { data?: { publish_id?: string } };
  const publishId = json.data?.publish_id ?? "";
  return {
    ok: true,
    externalId: publishId,
    url: draftMode
      ? "https://www.tiktok.com/notification/inbox"
      : `https://www.tiktok.com/`,
  };
}

async function refreshAccessToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const res = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `TikTok token refresh ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { access_token: string };
  return { ok: true, token: json.access_token };
}
