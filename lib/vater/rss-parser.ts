/**
 * RSS feed normalization for the VATER content pipeline.
 *
 * Wraps the `rss-parser` package and produces a uniform shape across the
 * 4 feed types we support: youtube, podcast, blog, social.
 *
 * Feed type is detected from the URL pattern when not specified by the
 * caller. The cron route uses this to upsert VaterRssItem rows.
 */
import Parser from "rss-parser";

export type FeedType = "youtube" | "podcast" | "blog" | "social";

export interface NormalizedFeedItem {
  guid: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  description: string | null;
  thumbnail: string | null;
}

export interface NormalizedFeed {
  feedType: FeedType;
  title: string | null;
  link: string | null;
  description: string | null;
  items: NormalizedFeedItem[];
}

/** Custom fields the YouTube RSS feed exposes via the `media:` namespace. */
type YouTubeItemExtras = {
  "media:group"?: {
    "media:thumbnail"?: Array<{ $?: { url?: string } }>;
    "media:description"?: string[];
  };
  "yt:videoId"?: string;
};

type PodcastItemExtras = {
  enclosure?: { url?: string; type?: string; length?: string };
  itunes?: { image?: string; duration?: string };
};

type SocialItemExtras = {
  "media:content"?: Array<{ $?: { url?: string } }>;
};

type AnyItem = Parser.Item &
  Partial<YouTubeItemExtras> &
  Partial<PodcastItemExtras> &
  Partial<SocialItemExtras>;

const parser: Parser<unknown, AnyItem> = new Parser({
  customFields: {
    item: [
      ["media:group", "media:group"],
      ["media:thumbnail", "media:thumbnail"],
      ["media:content", "media:content"],
      ["yt:videoId", "yt:videoId"],
      ["itunes:image", "itunes:image"],
    ],
  },
  timeout: 15_000,
});

/**
 * Detect feed type from URL.
 *
 * Order matters — youtube/social are URL-pattern-based and override
 * podcast/blog detection which depends on the parsed item shape.
 */
export function detectFeedTypeFromUrl(url: string): FeedType {
  const u = url.toLowerCase();
  if (u.includes("youtube.com/feeds/videos.xml") || u.includes("youtube.com/feeds/")) {
    return "youtube";
  }
  if (u.includes("rsshub.app/")) {
    return "social";
  }
  // Default — could be podcast or blog. Refined later in normalize().
  return "blog";
}

function pickThumbnail(item: AnyItem): string | null {
  // YouTube media:group → media:thumbnail[0].$.url
  const ytThumb = item["media:group"]?.["media:thumbnail"]?.[0]?.$?.url;
  if (ytThumb) return ytThumb;

  // social media:content
  const socialThumb = item["media:content"]?.[0]?.$?.url;
  if (socialThumb) return socialThumb;

  // podcast itunes image
  const itunesImage = item.itunes?.image;
  if (typeof itunesImage === "string") return itunesImage;

  // generic enclosure that's an image
  const enc = item.enclosure;
  if (enc?.url && enc.type?.startsWith("image/")) return enc.url;

  return null;
}

function pickDescription(item: AnyItem): string | null {
  const ytDesc = item["media:group"]?.["media:description"]?.[0];
  if (ytDesc) return ytDesc;
  if (item.contentSnippet) return item.contentSnippet;
  if (item.content) return item.content;
  if (item.summary) return item.summary;
  return null;
}

function pickGuid(item: AnyItem, fallbackUrl: string): string {
  if (item.guid) return item.guid;
  const ytId = item["yt:videoId"];
  if (typeof ytId === "string") return `yt:${ytId}`;
  // rss-parser's typed Item shape doesn't expose generic `id`, but some
  // feeds carry one as an extension field. Read it via index access.
  const maybeId = (item as unknown as { id?: unknown }).id;
  if (maybeId !== undefined && maybeId !== null) return String(maybeId);
  return fallbackUrl;
}

function pickPublishedAt(item: AnyItem): Date | null {
  const raw = item.isoDate || item.pubDate;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Refine the feed type after we have items in hand.
 *
 * - If any item has an `<enclosure>` with audio MIME → podcast
 * - If URL pre-detection said social/youtube → keep it
 * - Otherwise → blog
 */
function refineFeedType(initial: FeedType, items: AnyItem[]): FeedType {
  if (initial === "youtube" || initial === "social") return initial;
  const hasAudioEnclosure = items.some((it) => {
    const t = it.enclosure?.type;
    return typeof t === "string" && t.startsWith("audio/");
  });
  if (hasAudioEnclosure) return "podcast";
  return initial;
}

/**
 * Fetch + parse + normalize a feed URL.
 *
 * Throws on network or parse error — callers should surface errors via
 * the existing Toast system or error response, never silently swallow.
 */
export async function parseFeed(
  url: string,
  feedTypeOverride?: FeedType
): Promise<NormalizedFeed> {
  const parsed = await parser.parseURL(url);
  const initialType = feedTypeOverride ?? detectFeedTypeFromUrl(url);
  const items = (parsed.items ?? []) as AnyItem[];
  const feedType = feedTypeOverride ?? refineFeedType(initialType, items);

  const normalizedItems: NormalizedFeedItem[] = items.map((item) => {
    const itemUrl = item.link || "";
    return {
      guid: pickGuid(item, itemUrl),
      title: item.title ?? "(untitled)",
      url: itemUrl,
      publishedAt: pickPublishedAt(item),
      description: pickDescription(item),
      thumbnail: pickThumbnail(item),
    };
  });

  return {
    feedType,
    title: parsed.title ?? null,
    link: parsed.link ?? null,
    description: parsed.description ?? null,
    items: normalizedItems,
  };
}

/**
 * Lightweight URL probe used by the Add-Feed form.
 *
 * Returns the first 5 items as a "preview" so the user can confirm
 * they're adding the right feed before saving. Errors propagate up.
 */
export async function probeFeed(url: string): Promise<{
  feedType: FeedType;
  title: string | null;
  sampleItems: NormalizedFeedItem[];
}> {
  const feed = await parseFeed(url);
  return {
    feedType: feed.feedType,
    title: feed.title,
    sampleItems: feed.items.slice(0, 5),
  };
}
