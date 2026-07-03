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

export async function postOne(platform: Platform, input: PostInput): Promise<PostResult> {
  const fn = POSTERS[platform];
  if (!fn) return { ok: false, error: `Unknown platform: ${platform}` };
  try {
    return await fn(input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type { Platform, PostInput, PostResult } from "./types";
