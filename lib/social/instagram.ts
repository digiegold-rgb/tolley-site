import { combineCaptionAndTags, type PostInput, type PostResult } from "./types";
import { getStoredToken } from "./token-store";

const API_VERSION = process.env.FACEBOOK_API_VERSION || "v18.0";
const FB_API = "https://graph.facebook.com";

/**
 * Instagram Business publishing through the Graph API. Two-step process:
 *   1. POST /{ig-user-id}/media        → returns container id
 *   2. POST /{ig-user-id}/media_publish → returns IG media id
 *
 * Reels: pass media_type=REELS. Single-image post: pass image_url.
 *
 * Env: INSTAGRAM_BUSINESS_ID + a FB Page token that has instagram_basic +
 * instagram_content_publish + pages_read_engagement scopes.
 */
export async function postInstagram(input: PostInput): Promise<PostResult> {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ID?.trim();
  // A token re-authed through /api/social/oauth/facebook (with instagram_basic +
  // instagram_content_publish) is stored in the DB and wins; the env tokens are
  // legacy fallbacks that lack the IG publish scopes (error #10).
  const stored = await getStoredToken("instagram");
  const token =
    stored?.accessToken ||
    process.env.INSTAGRAM_PAGE_TOKEN ||
    process.env.FACEBOOK_PAGE_TOKEN_TREASURE ||
    process.env.FACEBOOK_PAGE_TOKEN_MAIN;

  if (!igUserId || !token) {
    return {
      ok: false,
      error: "Instagram not connected (need INSTAGRAM_BUSINESS_ID + FB page token)",
    };
  }

  const caption = combineCaptionAndTags(input);

  // Step 1: create container
  const containerParams = new URLSearchParams({
    caption,
    access_token: token,
  });
  if (input.mediaType === "video") {
    containerParams.set("media_type", "REELS");
    containerParams.set("video_url", input.mediaUrl);
  } else {
    containerParams.set("image_url", input.mediaUrl);
  }

  const cRes = await fetch(`${FB_API}/${API_VERSION}/${igUserId}/media`, {
    method: "POST",
    body: containerParams,
  });
  if (!cRes.ok) {
    const text = await cRes.text();
    return { ok: false, error: `IG container ${cRes.status}: ${text.slice(0, 200)}` };
  }
  const { id: containerId } = (await cRes.json()) as { id: string };

  // Step 2: video containers may need a few seconds to finish processing.
  if (input.mediaType === "video") {
    const ready = await waitForContainerReady(containerId, token);
    if (!ready.ok) return ready;
  }

  // Step 3: publish
  const pRes = await fetch(`${FB_API}/${API_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: token,
    }),
  });
  if (!pRes.ok) {
    const text = await pRes.text();
    return { ok: false, error: `IG publish ${pRes.status}: ${text.slice(0, 200)}` };
  }
  const { id: mediaId } = (await pRes.json()) as { id: string };

  return {
    ok: true,
    externalId: mediaId,
    url: `https://www.instagram.com/reel/${mediaId}/`,
  };
}

async function waitForContainerReady(
  containerId: string,
  token: string,
): Promise<PostResult> {
  // Poll up to 60s for the container to finish processing.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const res = await fetch(
      `${FB_API}/${API_VERSION}/${containerId}?fields=status_code&access_token=${token}`,
    );
    if (!res.ok) continue;
    const { status_code: status } = (await res.json()) as { status_code: string };
    if (status === "FINISHED") return { ok: true, externalId: containerId, url: "" };
    if (status === "ERROR") return { ok: false, error: "IG container processing error" };
  }
  return { ok: false, error: "IG container did not finish in 60s" };
}
