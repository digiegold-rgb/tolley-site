import { combineCaptionAndTags, type PostInput, type PostResult } from "./types";

const PIN_API = "https://api.pinterest.com/v5";
const SERVICE_URL = process.env.PINTEREST_SERVICE_URL;
const SERVICE_API_KEY = process.env.PINTEREST_SERVICE_API_KEY;

async function postViaDGXService(input: PostInput): Promise<PostResult> {
  if (!SERVICE_URL || !SERVICE_API_KEY) {
    return { ok: false, error: "Pinterest service URL/key not set" };
  }
  try {
    const res = await fetch(`${SERVICE_URL}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": SERVICE_API_KEY,
      },
      body: JSON.stringify({
        caption: combineCaptionAndTags(input).slice(0, 500),
        mediaUrl: input.mediaUrl,
        title: input.title?.slice(0, 100),
      }),
      // Pin upload + form fill takes 30-45s.
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `PI-svc ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      return { ok: false, error: json.error || "Pinterest service reported failure" };
    }
    return {
      ok: true,
      externalId: `pi-svc-${Date.now()}`,
      url: "https://www.pinterest.com/",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "PI service unreachable" };
  }
}

export async function pinterestServiceHealth(): Promise<{
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
 * Pinterest API v5. Pins require a board id and either a media source
 * (image_url or video) and a link.
 *
 * Env:
 *   PINTEREST_ACCESS_TOKEN  — long-lived bearer
 *   PINTEREST_DEFAULT_BOARD — fallback board id
 *   PINTEREST_DEFAULT_LINK  — fallback destination URL (e.g. https://tolley.io)
 */
export async function postPinterest(input: PostInput): Promise<PostResult> {
  // Prefer the DGX Selenium service (works today even though Pinterest's
  // dev app is trial-denied — we drive the pin-creation-tool via Chromium).
  if (SERVICE_URL && SERVICE_API_KEY) {
    return postViaDGXService(input);
  }

  const token = process.env.PINTEREST_ACCESS_TOKEN;
  const boardId = process.env.PINTEREST_DEFAULT_BOARD;

  if (!token || !boardId) {
    return {
      ok: false,
      error: "Pinterest not connected (DGX service not running and no API token)",
    };
  }

  const link = process.env.PINTEREST_DEFAULT_LINK || "https://tolley.io";
  const description = combineCaptionAndTags(input);

  const media_source =
    input.mediaType === "video"
      ? {
          source_type: "video_url",
          url: input.mediaUrl,
          cover_image_url: input.thumbnailUrl ?? input.mediaUrl,
        }
      : {
          source_type: "image_url",
          url: input.mediaUrl,
        };

  const res = await fetch(`${PIN_API}/pins`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: boardId,
      title: input.title?.slice(0, 100) ?? description.slice(0, 100),
      description: description.slice(0, 800),
      link,
      media_source,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Pinterest ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { id: string };
  return {
    ok: true,
    externalId: json.id,
    url: `https://www.pinterest.com/pin/${json.id}/`,
  };
}
