import { postBackAtYou } from "./backatyou";
import { postFacebook } from "./facebook";
import { postInstagram } from "./instagram";
import { postPinterest } from "./pinterest";
import { postTikTok } from "./tiktok";
import { postYouTube } from "./youtube";
import type { Platform, PostInput, PostResult } from "./types";

const POSTERS: Record<Platform, (input: PostInput) => Promise<PostResult>> = {
  youtube: postYouTube,
  tiktok: postTikTok,
  instagram: postInstagram,
  facebook: postFacebook,
  pinterest: postPinterest,
  backatyou: postBackAtYou,
};

// Action-cam /social renditions come in two publish-grade 1080p crops cut from
// the raw original. One queued row serves every platform: swap the fmt param so
// TikTok/IG pull native 9:16 while YouTube/FB/Pinterest pull 16:9. Non-action
// URLs (and the /file recap URLs) pass through untouched.
const VERTICAL_PLATFORMS: Set<Platform> = new Set(["tiktok", "instagram"]);

function withPlatformCrop(mediaUrl: string, platform: Platform): string {
  try {
    const u = new URL(mediaUrl);
    if (u.hostname === "action-api.tolley.io" && u.pathname === "/social") {
      u.searchParams.set("fmt", VERTICAL_PLATFORMS.has(platform) ? "vertical" : "wide");
      return u.toString();
    }
  } catch {
    /* not an absolute URL — leave as-is */
  }
  return mediaUrl;
}

export async function postOne(platform: Platform, input: PostInput): Promise<PostResult> {
  const fn = POSTERS[platform];
  if (!fn) return { ok: false, error: `Unknown platform: ${platform}` };
  try {
    return await fn({ ...input, mediaUrl: withPlatformCrop(input.mediaUrl, platform) });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type { Platform, PostInput, PostResult } from "./types";
