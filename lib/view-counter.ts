// Channel roster for the /hq Posts-tab view counter. The DGX collector
// (~/growth-engine/view-counter/collect.mjs) pushes ChannelViewStat rows keyed
// by these `key`s — add a channel here AND there or it never gets data.
//
// contentSince: the earliest date the channel had any content. When a window
// starts before we have snapshot history but after all content existed, the
// lifetime total IS the window total (a 30d window on a 1-week-old channel is
// just "everything"). This is what makes brand-new channels (yt-ruthann) show
// real numbers on day one instead of "no data".

export interface ViewChannel {
  key: string;
  platform: "youtube" | "facebook" | "tiktok" | "x" | "bluesky";
  label: string;
  note?: string; // secondary line on the card
  url: string;
  contentSince?: string; // ISO date
  /**
   * Ignore stored subscriber history before this date when computing deltas.
   * Set this when a card is REPOINTED at a different channel: the rows already
   * in the table belong to the previous account, and differencing against them
   * reports a fake collapse (yt-ykh showed "-18,700 subs in 1d" the moment it
   * moved off @digitalgold). Views history is left alone — only the delta
   * baseline moves.
   */
  subsSince?: string; // ISO date
}

export const VIEW_CHANNELS: readonly ViewChannel[] = [
  {
    key: "yt-dgd",
    platform: "youtube",
    label: "Digital Gold Diggers",
    note: "animated series · trailer live 8/3",
    url: "https://www.youtube.com/@digitalgold-diggers",
    contentSince: "2026-08-03",
  },
  {
    // Was pointed at @yourkchome (now crypto again) AND the collector was
    // pulling this card's numbers from the @digitalgold token — so this card
    // never showed KC Homes at all. Both fixed 2026-08-03.
    key: "yt-ykh",
    platform: "youtube",
    label: "Your KC Homes",
    note: "KC news · listings · W&D",
    url: "https://www.youtube.com/@yourkchomes",
    contentSince: "2026-08-03",
    subsSince: "2026-08-04",
  },
  {
    key: "yt-ruthann",
    platform: "youtube",
    label: "Ruthann's Treasure Hauls",
    note: "haul shorts",
    url: "https://www.youtube.com/channel/UCqSvlHgO3bKON29JJ5Jw-7g",
    contentSince: "2026-07-24",
  },
  {
    key: "fb-treasure",
    platform: "facebook",
    label: "Ruthann's Treasure Haul",
    note: "hauls + estate sales",
    url: "https://www.facebook.com/1156652300855210",
    contentSince: "2026-07-01",
  },
  {
    key: "fb-wd",
    platform: "facebook",
    label: "Wash & Dry Rental KC",
    note: "washer/dryer rentals",
    url: "https://www.facebook.com/1060351927154451",
  },
  {
    key: "tt-jared",
    platform: "tiktok",
    label: "Treasure Huals",
    note: "haul shorts · TT shop",
    url: "https://www.tiktok.com/@digitaljared",
  },
  {
    // Bluesky has no view metric — this card is followers-only by design.
    key: "bsky-ykh",
    platform: "bluesky",
    label: "Your KC Homes",
    note: "KC content mirror",
    url: "https://bsky.app/profile/yourkchomes.bsky.social",
    contentSince: "2026-08-06",
  },
  {
    // Scraped from the shared Claude Browser profile (same one-time-login
    // pattern as tt-jared). No contentSince: the account may have tweets older
    // than tracking, so windows honestly show "since tracking began" instead
    // of claiming lifetime = window.
    key: "x-ykh",
    platform: "x",
    label: "Your KC Homes",
    note: "KC content · affiliate links",
    url: "https://x.com/yourkchomes",
  },
  {
    key: "fb-re",
    platform: "facebook",
    label: "Your KC Homes",
    note: "real estate page",
    url: "https://www.facebook.com/230414410149647",
  },
];

export const CHANNEL_KEYS = new Set(VIEW_CHANNELS.map((c) => c.key));
