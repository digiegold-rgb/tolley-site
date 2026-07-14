import { combineCaptionAndTags, type PostInput, type PostResult } from "./types";

const API_VERSION = process.env.FACEBOOK_API_VERSION || "v18.0";
const FB_API = "https://graph.facebook.com";

// Which FB page a post lands on depends on which business it came from.
// The Graph API cannot post to a personal profile (Meta removed that in 2018),
// so "action" needs its own page configured via FACEBOOK_PAGE_ID_ACTION —
// until then action-cam FB posts fail loudly instead of landing on the wrong brand.
const SOURCE_ENV_SUFFIX: Record<string, string> = {
  shop: "TREASURE",
  treasure: "TREASURE",
  realestate: "RE",
  wd: "WD",
  action: "ACTION",
};

function pickPageAndToken(source?: string): { pageId: string; token: string } | null {
  // Global override wins: SOCIAL_FACEBOOK_PAGE_ID + SOCIAL_FACEBOOK_PAGE_TOKEN_ENV.
  const overridePageId = process.env.SOCIAL_FACEBOOK_PAGE_ID;
  const overrideTokenEnv = process.env.SOCIAL_FACEBOOK_PAGE_TOKEN_ENV;
  if (overridePageId && overrideTokenEnv) {
    const token = process.env[overrideTokenEnv];
    if (token) return { pageId: overridePageId, token };
  }
  const suffix = SOURCE_ENV_SUFFIX[source ?? ""];
  if (suffix) {
    const pageId = process.env[`FACEBOOK_PAGE_ID_${suffix}`];
    const token = process.env[`FACEBOOK_PAGE_TOKEN_${suffix}`];
    if (pageId && token) return { pageId, token };
    return null; // source has a designated page but it isn't configured — don't fall back to another brand
  }
  // Unrouted sources (manual uploads, crons) keep the Treasure Haul default.
  const pageId = process.env.FACEBOOK_PAGE_ID_TREASURE;
  const token = process.env.FACEBOOK_PAGE_TOKEN_TREASURE;
  if (pageId && token) return { pageId, token };
  return null;
}

export async function postFacebook(input: PostInput): Promise<PostResult> {
  const cfg = pickPageAndToken(input.source);
  if (!cfg) {
    return {
      ok: false,
      error: `Facebook: no page configured for source "${input.source ?? "unknown"}" (set FACEBOOK_PAGE_ID_${SOURCE_ENV_SUFFIX[input.source ?? ""] ?? "…"} + token; personal profiles can't be posted to via API)`,
    };
  }

  const description = combineCaptionAndTags(input);

  if (input.mediaType === "video") {
    return uploadVideo(cfg.pageId, cfg.token, input.mediaUrl, description, input.title ?? "");
  }
  return uploadPhoto(cfg.pageId, cfg.token, input.mediaUrl, description);
}

async function uploadVideo(
  pageId: string,
  token: string,
  fileUrl: string,
  description: string,
  title: string,
): Promise<PostResult> {
  const url = `${FB_API}/${API_VERSION}/${pageId}/videos`;
  const params = new URLSearchParams({
    file_url: fileUrl,
    description,
    title: title || description.slice(0, 80),
    access_token: token,
  });
  const res = await fetch(url, { method: "POST", body: params });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `FB video upload ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { id: string };
  return {
    ok: true,
    externalId: json.id,
    url: `https://www.facebook.com/${pageId}/videos/${json.id}`,
  };
}

async function uploadPhoto(
  pageId: string,
  token: string,
  fileUrl: string,
  caption: string,
): Promise<PostResult> {
  const url = `${FB_API}/${API_VERSION}/${pageId}/photos`;
  const params = new URLSearchParams({
    url: fileUrl,
    caption,
    access_token: token,
  });
  const res = await fetch(url, { method: "POST", body: params });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `FB photo upload ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { id?: string; post_id?: string };
  const id = json.post_id ?? json.id ?? "";
  return {
    ok: true,
    externalId: id,
    url: `https://www.facebook.com/${id}`,
  };
}
