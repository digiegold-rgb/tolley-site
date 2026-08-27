/**
 * lib/vater/listing/proof-stats.ts — the "living proof" number on the
 * Listing Studio landing: Jared's REAL 30-day views across his own
 * real-estate socials, from the same ChannelViewStat / ChannelVideoStat rows
 * the /hq view counter renders. Null when there is no data — the landing
 * hides the card rather than showing a made-up figure.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { VIEW_CHANNELS } from "@/lib/view-counter";
import { channelWindows, groupByChannel } from "@/lib/view-counter-windows";

/** Jared's real-estate channels (lib/view-counter.ts keys). */
export const PROOF_CHANNEL_KEYS = ["yt-ykh", "fb-re", "pi-homes", "x-ykh"] as const;

export interface ListingProofStats {
  /** Sum of 30-day views across PROOF_CHANNEL_KEYS. */
  views30d: number;
  /** ISO timestamp of the newest row that fed the number. */
  asOf: string;
  /** Channels that actually contributed a number. */
  channels: Array<{ key: string; label: string; views30d: number; partial: boolean }>;
}

export async function listingProofStats(): Promise<ListingProofStats | null> {
  const keys = [...PROOF_CHANNEL_KEYS];
  let rows: Awaited<ReturnType<typeof prisma.channelViewStat.findMany>>;
  let vidRows: Awaited<ReturnType<typeof prisma.channelVideoStat.findMany>>;
  try {
    [rows, vidRows] = await Promise.all([
      prisma.channelViewStat.findMany({ where: { channelKey: { in: keys } }, orderBy: { day: "asc" } }),
      prisma.channelVideoStat.findMany({
        where: { channelKey: { in: keys }, publishedAt: { gte: new Date(Date.now() - 370 * 86400_000) } },
        orderBy: { publishedAt: "desc" },
      }),
    ]);
  } catch (err) {
    console.error("[listing/proof-stats] read failed", err);
    return null;
  }
  if (rows.length === 0 && vidRows.length === 0) return null;

  const byChannel = groupByChannel(rows);
  const vidsByChannel = groupByChannel(vidRows);
  const now = Date.now();
  let total = 0;
  let any = false;
  let asOfMs = 0;
  const channels: ListingProofStats["channels"] = [];
  for (const key of keys) {
    const cfg = VIEW_CHANNELS.find((c) => c.key === key);
    if (!cfg) continue;
    const w = channelWindows(byChannel.get(key) ?? [], vidsByChannel.get(key) ?? [], cfg, now, [30]);
    const d30 = w.windows.d30;
    if (!d30 || d30.views === null) continue;
    any = true;
    total += d30.views;
    channels.push({ key, label: cfg.label, views30d: d30.views, partial: d30.partial });
    for (const r of w.hist) asOfMs = Math.max(asOfMs, r.pulledAt.getTime());
    for (const v of w.allVids) asOfMs = Math.max(asOfMs, v.pulledAt.getTime());
  }
  if (!any || total <= 0) return null;
  return { views30d: total, asOf: new Date(asOfMs || now).toISOString(), channels };
}
