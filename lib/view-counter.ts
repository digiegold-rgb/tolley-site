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
  platform: "youtube" | "facebook" | "tiktok";
  label: string;
  note?: string; // secondary line on the card
  url: string;
  contentSince?: string; // ISO date
}

export const VIEW_CHANNELS: readonly ViewChannel[] = [
  {
    key: "yt-ykh",
    platform: "youtube",
    label: "Your KC Homes",
    note: "KC news · listings · W&D",
    url: "https://www.youtube.com/@yourkchome",
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
    key: "fb-re",
    platform: "facebook",
    label: "Your KC Homes",
    note: "real estate page",
    url: "https://www.facebook.com/230414410149647",
  },
];

export const CHANNEL_KEYS = new Set(VIEW_CHANNELS.map((c) => c.key));
