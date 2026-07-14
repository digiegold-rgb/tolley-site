export type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest"
  | "backatyou";

export const ALL_PLATFORMS: Platform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "pinterest",
  "backatyou",
];

export interface PostInput {
  id: string; // SocialPost.id
  source?: string; // SocialPost.source — drives per-brand account routing (e.g. FB page)
  mediaUrl: string;
  mediaType: "video" | "image" | "carousel";
  thumbnailUrl?: string | null;
  title?: string | null;
  caption: string;
  hashtags: string[];
}

export type PostResult =
  | { ok: true; externalId: string; url: string }
  | { ok: false; error: string };

export function combineCaptionAndTags(input: PostInput, sep = "\n\n"): string {
  const tags = input.hashtags.filter(Boolean).join(" ");
  return tags ? `${input.caption}${sep}${tags}` : input.caption;
}
