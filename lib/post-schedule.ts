// ── Expected posting cadence — the half of the Posts tab that catches silence ──
//
// PostLogEntry records what DID fire. This file declares what SHOULD fire.
// Comparing the two is the whole point: a job that dies writes no row, so an
// empty log looks exactly like a healthy quiet day. Instagram proved it —
// token revoked 2026-07-24, 86 posts failed silently, nobody noticed for 4 days.
//
// Adding a channel to a job WITHOUT adding it here means it will never be
// alarmed on. Every new posting job must land in this registry or it is
// invisible-by-default all over again.

export type ExpectedChannel = {
  channel: string; // must match PostLogEntry.channel exactly
  account?: string; // which identity — Jared and Ruthann own different pages
  business?: string; // haul | ykh | wd | estate
};

export type ScheduledJob = {
  job: string; // must match PostLogEntry.job exactly
  label: string;
  schedule: string; // human-readable, shown in the tab
  unit: string; // where it lives, so a dark job is findable
  // Hours after the last successful fire before we call the channel dark.
  // Set to the cadence + a generous grace: a daily job that renders for 80
  // minutes and occasionally retries should not red out for being 3h late.
  staleAfterHours: number;
  channels: ExpectedChannel[];
};

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    job: "growth-shorts",
    label: "Product shorts (2/day)",
    schedule: "10:00 daily",
    unit: "growth-shorts.timer",
    staleAfterHours: 30,
    channels: [
      { channel: "yt", account: "yourkchome", business: "haul" },
      { channel: "fb", account: "ruthanns-treasure-haul", business: "haul" },
      { channel: "ig", account: "ruthanntolley", business: "haul" },
      { channel: "pin", account: "tolley", business: "haul" },
      { channel: "tt", account: "yourkchomes", business: "haul" },
      { channel: "bsky", account: "haul.tolley.io", business: "haul" },
      { channel: "threads", account: "ruthanntolley", business: "haul" },
      { channel: "x", account: "yourkchomes", business: "haul" },
    ],
  },
  {
    job: "listings-video",
    label: "New KC Homes Today",
    schedule: "10:30 daily",
    unit: "listings-video.timer",
    staleAfterHours: 30,
    channels: [{ channel: "yt", account: "yourkchome", business: "ykh" }],
  },
  {
    job: "pin-circle",
    label: "Pinterest board circle",
    schedule: "09:08 daily",
    unit: "pin-circle.timer",
    staleAfterHours: 30,
    channels: [{ channel: "pin", account: "tolley", business: "ykh" }],
  },
  {
    job: "pin-featured",
    label: "Pinterest featured homes",
    schedule: "19:30 daily",
    unit: "pin-featured.timer",
    staleAfterHours: 30,
    channels: [{ channel: "pin", account: "tolley", business: "ykh" }],
  },
  {
    job: "pin-treasure",
    label: "Pinterest Treasure Haul",
    schedule: "08:00, 13:00, 19:00 daily",
    unit: "crontab — pinterest_cron_post.sh",
    staleAfterHours: 14,
    channels: [{ channel: "pin", account: "tolley", business: "haul" }],
  },
  {
    job: "fb-daily-post",
    label: "Facebook daily post",
    schedule: "09:00 daily",
    unit: "crontab — fb-daily-post.sh",
    staleAfterHours: 30,
    channels: [{ channel: "fb", account: "yourkchomes", business: "ykh" }],
  },
  {
    job: "marketplace-lister",
    label: "Marketplace service listings",
    schedule: "07:00 + 16:00, Mon–Sat",
    unit: "crontab — marketplace-service-lister.py",
    staleAfterHours: 40, // Sunday is a legitimate gap — do not red out on it
    channels: [{ channel: "marketplace", account: "yourkchomes", business: "ykh" }],
  },
  {
    job: "craigslist-poster",
    label: "Craigslist weekly",
    schedule: "Mon 10:00",
    unit: "crontab — craigslist-poster.sh",
    staleAfterHours: 8 * 24,
    channels: [{ channel: "craigslist", account: "yourkchomes", business: "ykh" }],
  },
  {
    job: "wd-listings",
    label: "Washer/Dryer listings",
    schedule: "11:00 Mon/Thu",
    unit: "wd-listings.timer",
    staleAfterHours: 5 * 24,
    channels: [
      { channel: "marketplace", account: "yourkchomes", business: "wd" },
      { channel: "fb", account: "yourkchomes", business: "wd" },
    ],
  },
];

export type ChannelHealth = ExpectedChannel & {
  job: string;
  jobLabel: string;
  schedule: string;
  unit: string;
  status: "ok" | "failing" | "dark" | "never";
  lastFiredAt: string | null;
  lastUrl: string | null;
  lastError: string | null;
  hoursSince: number | null;
};

type LatestRow = {
  job: string;
  channel: string;
  status: string;
  firedAt: Date;
  url: string | null;
  error: string | null;
};

// Reduce the raw ledger to one health verdict per declared job×channel.
//
// "never" and "dark" are deliberately distinct: never = we declared this channel
// but it has not posted once (usually a job that was never instrumented), dark =
// it used to work and stopped. They need different fixes, so they get different
// words.
export function computeHealth(latest: LatestRow[], now = new Date()): ChannelHealth[] {
  const byKey = new Map<string, LatestRow>();
  for (const row of latest) {
    const key = `${row.job}::${row.channel}`;
    const prev = byKey.get(key);
    if (!prev || row.firedAt > prev.firedAt) byKey.set(key, row);
  }

  const out: ChannelHealth[] = [];
  for (const job of SCHEDULED_JOBS) {
    for (const ch of job.channels) {
      const row = byKey.get(`${job.job}::${ch.channel}`);
      const base = {
        ...ch,
        job: job.job,
        jobLabel: job.label,
        schedule: job.schedule,
        unit: job.unit,
      };
      if (!row) {
        out.push({
          ...base,
          status: "never",
          lastFiredAt: null,
          lastUrl: null,
          lastError: null,
          hoursSince: null,
        });
        continue;
      }
      const hoursSince = (now.getTime() - row.firedAt.getTime()) / 3_600_000;
      // A stale channel is dark even if its last row said ok — "it worked once,
      // three weeks ago" is exactly the failure this tab exists to surface.
      const status: ChannelHealth["status"] =
        hoursSince > job.staleAfterHours ? "dark" : row.status === "ok" ? "ok" : "failing";
      out.push({
        ...base,
        status,
        lastFiredAt: row.firedAt.toISOString(),
        lastUrl: row.url,
        lastError: row.error,
        hoursSince: Math.round(hoursSince * 10) / 10,
      });
    }
  }
  return out;
}
